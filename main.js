//@ts-nocheck
'use-strict';

import { getImage2DDimensions, image2DToImageData, imageDataToImage2D } from './src/image2d.js';
import { WorkerMessageTypes, workerComputeDifferenceOfGaussians, workerComputeGaussianScaleSpace, workerFindCandidateKeypoints } from './src/worker.js';

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
const SCALE_LEVELS = 3;
const INITIAL_BLUR = 1.6;

let input_image_2d = null;
let background_thread = null;
let main_canvas = null;
let main_canvas_context = null;

let gaussian_scale_space = null;
let difference_of_gaussians = null;




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
        main_canvas.width = image_element.width * 2;
        main_canvas.height = image_element.height * 2;


        //Cache a handle to the main canvas's context as well.
        main_canvas_context = main_canvas.getContext('2d');


        //When the image loads, draw the image on the main canvas
        //and clean up the resources used by `.createObjectURL()`.
        main_canvas_context.drawImage(image_element, 0, 0);
        URL.revokeObjectURL(image_url);


        //Convert the image to a grayscale Image2D array and draw it 
        //onto the main canvas.
        //const ide = new ImageDataEx();
        //ide.loadDataFrom(main_canvas_context.getImageData(0, 0, image_element.width, image_element.height));
        //ide.printSelf();
        input_image_2d = imageDataToImage2D(main_canvas_context.getImageData(0, 0, image_element.width, image_element.height));
        main_canvas_context.putImageData(image2DToImageData(input_image_2d), 0, 0);


        //Now that the image is loaded, begin the SIFT algorithm by
        //generating the Gaussian Scale Space.
        workerComputeGaussianScaleSpace(background_thread, {
          input_image: input_image_2d,
          min_blur_level: INITIAL_BLUR,
          chunk_size: CHUNK_SIZE,
          number_of_octaves: MAX_OCTAVES,
          scales_per_octave: SCALE_LEVELS,
        });
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
    case WorkerMessageTypes.RECEIVED_GAUSSIAN_BLURRED_CHUNK:
      onReceiveGaussianBlurredChunk(event.data);
      break;


    case WorkerMessageTypes.RECEIVED_GAUSSIAN_BLURRED_IMAGE:
      onReceiveGaussianBlurredImage(event.data);
      break;


    case WorkerMessageTypes.RECEIVED_GAUSSIAN_SCALE_SPACE:
      onReceiveGaussianScaleSpace(event.data);
      break;


    case WorkerMessageTypes.RECEIVED_DIFFERENCE_OF_GAUSSIAN_IMAGE:
      onReceiveDifferenceOfGaussianImage(event.data);
      break;

    case WorkerMessageTypes.RECEIVED_DIFFERENCE_OF_GAUSSIAN_CHUNK:
      onReceiveDifferenceOfGaussianChunk(event.data);
      break;


    case WorkerMessageTypes.RECEIVED_DIFFERENCE_OF_GAUSSIANS:
      onReceiveDifferenceOfGaussians(event.data);
      break;


    case WorkerMessageTypes.RECEIVED_CANDIDATE_KEYPOINT_IMAGE:
      onReceiveCandidateKeypointImage(event.data);
      break;


    default:
      console.log('main.js received the following :');
      console.log(event.data);
  }
}



function onReceiveGaussianBlurredChunk({ imageData, dx, dy }) {

  //Update the main canvas with the received chunk image data.
  main_canvas_context.putImageData(imageData, dx, dy);
}


function onReceiveGaussianBlurredImage({ imageData, octave }) {

  //Resize the main canvas according to the current octave image.
  if (main_canvas.width !== imageData.width) main_canvas.width = imageData.width;
  if (main_canvas.height !== imageData.height) main_canvas.height = imageData.height;


  //Update the main canvas image.
  main_canvas_context.putImageData(imageData, 0, 0);


  addMainCanvasImageToGaussianStackContainer(octave);
}


function onReceiveGaussianScaleSpace({ scaleSpace }) {

  //Cache the resulting Gaussian scale space.
  gaussian_scale_space = scaleSpace;


  //Resize the main canvas to the first image in the scale space before
  //starting to compute the difference of Gaussians.
  const [_width, _height] = getImage2DDimensions(scaleSpace[0][0].image);
  main_canvas.width = _width;
  main_canvas.height = _height;


  workerComputeDifferenceOfGaussians(background_thread, scaleSpace);
}


function onReceiveDifferenceOfGaussianImage({ imageData, octave }) {
  //Resize the main canvas according to the current octave image.
  if (main_canvas.width !== imageData.width) main_canvas.width = imageData.width;
  if (main_canvas.height !== imageData.height) main_canvas.height = imageData.height;


  //Update the main canvas image.
  main_canvas_context.putImageData(imageData, 0, 0);


  addMainCanvasImageToDoGStackContainer(octave);
}


function onReceiveDifferenceOfGaussianChunk({ imageData, dx, dy }) {

  //Update the main canvas with the received chunk image data.
  main_canvas_context.putImageData(imageData, dx, dy);
}




function onReceiveDifferenceOfGaussians({ differenceOfGaussians }) {

  //Cache the resulting difference of Gaussians.
  difference_of_gaussians = differenceOfGaussians;

  workerFindCandidateKeypoints(
    background_thread,
    differenceOfGaussians,
    gaussian_scale_space.map(octave => octave[0].image),
  );
}




function onReceiveCandidateKeypointImage({ imageData, octave }) {
  //Resize the main canvas according to the current octave image.
  if (main_canvas.width !== imageData.width) main_canvas.width = imageData.width;
  if (main_canvas.height !== imageData.height) main_canvas.height = imageData.height;


  //Update the main canvas image.
  main_canvas_context.putImageData(imageData, 0, 0);


  addMainCanvasImageToCandidateKeypointsContainer(octave);
}




//------------------------------------------------------------------------------




function addMainCanvasImageToGaussianStackContainer(octave) {
  const canvas = document.createElement('canvas');
  canvas.height = main_canvas.height;
  canvas.width = main_canvas.width;
  canvas.getContext('2d').putImageData(main_canvas_context.getImageData(0, 0, main_canvas.width, main_canvas.height), 0, 0);


  document.getElementById(`octave-${octave + 1}-gaussian-stack-container`).append(canvas);
}




function addMainCanvasImageToDoGStackContainer(octave) {
  const canvas = document.createElement('canvas');
  canvas.height = main_canvas.height;
  canvas.width = main_canvas.width;
  canvas.getContext('2d').putImageData(main_canvas_context.getImageData(0, 0, main_canvas.width, main_canvas.height), 0, 0);


  document.getElementById(`octave-${octave + 1}-dog-stack-container`).append(canvas);
}





function addMainCanvasImageToCandidateKeypointsContainer(octave) {
  const canvas = document.createElement('canvas');
  canvas.height = main_canvas.height;
  canvas.width = main_canvas.width;
  canvas.getContext('2d').putImageData(main_canvas_context.getImageData(0, 0, main_canvas.width, main_canvas.height), 0, 0);


  document.getElementById(`octave-${octave + 1}-candidate-keypoints-container`).append(canvas);
}