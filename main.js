//@ts-nocheck
'use-strict';

import { getImageChunkBoundaries } from './src/image.js';
import { getImage2DDimensions, image2DLinearUpsample2x, image2DToImageData, imageDataToImage2D } from './src/image2d.js';
import { WorkerMessageTypes, workerGetBlurredChunk, workerGetOutputImage2D, workerSetTargetImage2D } from './src/worker.js';

/**
 * REQUIREMENTS
 * This project requires the latest version of a Chromium-based browser
 * to support `.showOpenFilePicker()`.
 * 
 * As well as a local http server to serve the page to support Worker
 * threads as well as ES Modules.
 */




//Global Variables
const CHUNK_SIZE = 32;
const MAX_OCTAVES = 4;
const MAX_SCALE_LEVELS = 5;
const INITIAL_SIGMA = 1.6;
let input_image_2d = null;
let background_thread = null;
let main_canvas = null;
let main_canvas_context = null;
let chunk_boundaries = null;
let current_chunk_index = -1;
let scale_space = null;
let current_octave_index = -1;
let current_scale_level_index = -1;



window.onload = _ => {

  //Check if the browser supports web-workers.
  if (window.Worker) {

    //The browser supports web-workers, we can proceed.


    //Initialize the background thread and setup the response handler.
    background_thread = new Worker('background.js', { type: 'module' });
    background_thread.onmessage = onBackgroundThreadRespond;


    //Setup the ability to load images using the file-picker.
    const load_button = document.getElementById('load-button');
    load_button.onclick = async _ => {

      //Destructure the 1-element array returned by `.showOpenFilePicker()`.
      const [image_file] = await window.showOpenFilePicker({
        types: [{
          description: 'Images',
          accept: { 'image/*': ['.png', '.gif', '.jpeg', '.jpg'] },
        }],
        excludeAcceptAllOption: true,
        multiple: false,
      });


      //Now that we have the image, load the image by first creating
      //an object URL for it. Pass that to a `<img>` element as it's
      //image source.
      const image_url = URL.createObjectURL(await image_file.getFile());
      const image_element = new Image();
      image_element.src = image_url;


      //Wait for the image to load.
      image_element.onload = _ => {

        //Cache a handle to the main canvas and set the canvas dimensions.
        main_canvas = document.getElementById('main-canvas');
        main_canvas.width = image_element.width;
        main_canvas.height = image_element.height;


        //Cache a handle to the main canvas's context as well.
        main_canvas_context = main_canvas.getContext('2d');


        //When the image loads, draw the image on the main canvas
        //and clean up the resources used by `.createObjectURL()`.
        main_canvas_context.drawImage(image_element, 0, 0);
        URL.revokeObjectURL(image_url);


        //Convert the image to a grayscale Image2D array and draw it 
        //onto the main canvas.
        input_image_2d = imageDataToImage2D(main_canvas_context.getImageData(0, 0, image_element.width, image_element.height));
        main_canvas_context.putImageData(image2DToImageData(input_image_2d), 0, 0);


        //Now, the image is loaded, start to setup the SIFT algorithm
        //by preparing to find potential keypoints using Scale Space
        //Extrema detection.
        prepareScaleSpaceExtremaDetection();
      };
    };
  }
  else {
    console.log('Your browser doesn\'t support web workers.');
  }
};





//------------------------------------------------------------------------------




function onBackgroundThreadRespond(event) {
  switch (event.data.type) {
    case WorkerMessageTypes.BLURRED_CHUNK_RESULT:
      onReceiveBlurredChunkResult(event.data);
      break;

    case WorkerMessageTypes.OUTPUT_IMAGE_2D_RESULT:
      onReceiveOutputImage2DResult(event.data);
      break;
    default:
      console.log('main.js received the following :');
      console.log(event.data);
  }
}




function onReceiveBlurredChunkResult(event) {

  //First update the canvas with the chunk image data.
  main_canvas_context.putImageData(
    event.chunkImageData,
    chunk_boundaries[current_chunk_index].x1,
    chunk_boundaries[current_chunk_index].y1
  );


  //Increment the chunk counter and check if all the chunks have been 
  //blurred already.
  current_chunk_index++;
  if (current_chunk_index < chunk_boundaries.length) {

    //There are still chunks left in the image to blur.


    //Send another chunk to the background thread to be blurred.
    workerGetBlurredChunk(
      background_thread,
      chunk_boundaries[current_chunk_index],
      event.sigma,
    );
  }
  else {

    //All the chunks in the image have been blurred.


    //Get the completed image_2d from the background thread.
    workerGetOutputImage2D(background_thread);
  }
}




function onReceiveOutputImage2DResult(event) {

  //Add the image_2d to the image stack.
  scale_space[current_octave_index].gaussians.push(event.image2D);
  console.log(`current_octave : ${current_octave_index}
current_scale_level : ${current_scale_level_index}
scale_space :
`);
  console.log(scale_space);


  //Add the main canvas image to the stack of gaussians
  addMainCanvasImageToGaussianStackContainer();


  //Is this the last image in the stack?
}




//------------------------------------------------------------------------------




function addMainCanvasImageToGaussianStackContainer() {
  const canvas = document.createElement('canvas');
  canvas.height = main_canvas.height;
  canvas.width = main_canvas.width;
  canvas.getContext('2d').putImageData(main_canvas_context.getImageData(0, 0, main_canvas.width, main_canvas.height), 0, 0);


  document.getElementById(`octave-${current_octave_index + 1}-gaussian-stack-container`).append(canvas);
}



function prepareScaleSpaceExtremaDetection() {
  const [width, height] = getImage2DDimensions(input_image_2d);

  /**
   * DETERMINING THE TOTAL NUMBER OF OCTAVES
   * 
   * Since each octave will resize the image down by 2, 
   * 
   * Calculate the number of times the image can be halved. Use the shorter
   * side of the image. If `s` is the short side of the image, `s / (2 ^ x) = 1`
   * can be used to express the shorter side of the image being divided by 2
   * `x` times to equal 1.
   * 
   * Solve for x :
   * s / (2 ^ x) = 1
   * s = 2 ^ x
   * log_2 (s) = x
   */
  const total_octaves = Math.min(Math.floor(Math.log2(width < height ? width : height)), MAX_OCTAVES);


  //Initialize the scale space object along with the octave and scale
  //level starting index.
  scale_space = [];
  for (let i = 0; i < total_octaves; i++) {
    scale_space.push({
      gaussians: [],
      differenceOfGaussians: [],
    });
  }
  current_octave_index = 0;
  current_scale_level_index = 0;


  //Generate the base image for the scale space.
  generateBaseImage();
}




function generateBaseImage() {

  /**
   * GENERATING THE BASE IMAGE
   * 
   * The base image, is generated by first resizing the image x2 using
   * linear interpolation. Then applying the initial blur of 1.6 to it.
   *
   * Since during the resize process, there is a minimum assumed blur 
   * of 0.5 applied, if we want the first image to have the correct
   * blur of 1.6 applied; It has to be calculated using the following:
   *
   * Using `sigma^2 = sigma_1^2 + sigma_2^2`, we can solve for the correct
   * blur to apply by setting up the equation like so:
   *
   * `(1.6)^2 = (2 * 0.5)^2 + sigma_2^2`
   * `(1.6)^2 - (2 * 0.5)^2 = sigma_2^2`
   * `Math.sqrt( (1.6)^2 - (2 * 0.5)^2 ) = sigma_2`
   * 
   * WHY `2 * 0.5` ?
   * 
   * The original paper states that the original image has an assumed blur
   * of 0.5 which is the minimum blur applied to prevent aliasing. This is
   * probably assuming that the image would have this blur due to some
   * external causes, etc. Since the image is doubled in size, the assumed
   * blur for the resized image would now be `2 * 0.5` = 1.0. This is also
   * detailed in the original paper.
   */


  //So first, start by linearly upsampling the input image and retreiving
  //the image dimensions.
  input_image_2d = image2DLinearUpsample2x(input_image_2d);
  const [width, height] = getImage2DDimensions(input_image_2d);


  //Pass this new upsampled image over to the background thread.
  workerSetTargetImage2D(background_thread, input_image_2d);


  //Update the main canvas to reflect this, this will give time for the
  //background thread to update the target image.
  main_canvas.height = height;
  main_canvas.width = width;
  main_canvas_context.putImageData(image2DToImageData(input_image_2d), 0, 0);


  //Calculate the multiplicative blur to apply on the image using the
  //formula derived earlier.
  const assumed_sigma = 0.5;
  const base_image_sigma = Math.sqrt(Math.max(0.01, Math.pow(INITIAL_SIGMA, 2) - Math.pow(2 * assumed_sigma, 2)));


  //Regenerate the chunk boundaries of the new input image, reset the current chunk
  //index, and begin blurring with the calculated sigma value.
  chunk_boundaries = getImageChunkBoundaries(width, height, CHUNK_SIZE);
  current_chunk_index = 0;
  workerGetBlurredChunk(background_thread, chunk_boundaries[current_chunk_index], base_image_sigma);
}