//@ts-nocheck
'use-strict';

import { convertDoGImage2DToImageData } from './src/dog.js';
import { ImageDataEx } from './src/image-data-ex.js';
import { getImage2DDimensions, image2DLinearDownsample2x, image2DLinearUpsample2x, image2DToImageData, imageDataToImage2D, normalizeImage2D } from './src/image2d.js';
import { WorkerMessageTypes, workerGetBlurredChunk, workerGetDoGChunk, workerGetOutputImage2D, workerGetPotentialKeypoints, workerSetDetectionTargets, workerSetDoGTargets, workerSetTargetImage2D } from './src/worker.js';
import { getImageChunkBoundaries } from './unused/image.js';

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
let incremental_sigmas = null;
let state = null;




const State = {
  GENERATE_GAUSSIAN_PYRAMID: 'generate-gaussian-pyramid',
  GENERATE_DOG_PYRAMID: 'generate-dog-pyramid',
  DETECT_LOCAL_EXTREMA: 'detect-local-extrema'
};



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
        const ide = new ImageDataEx();
        ide.loadDataFrom(main_canvas_context.getImageData(0, 0, image_element.width, image_element.height));
        ide.printSelf();
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
      if (state === State.GENERATE_GAUSSIAN_PYRAMID) {
        onReceiveBlurredImage2DResult(event.data);
      }
      else if (state === State.GENERATE_DOG_PYRAMID) {
        onReceiveDoGImage2DResult(event.data);
      }
      break;

    case WorkerMessageTypes.DOG_CHUNK_RESULT:
      onReceiveDoGChunkResult(event.data);
      break;

    case WorkerMessageTypes.MESSAGE_QUEUE_TEST:
      console.log(`Received : ${event.data.data}`);
      for (let i = 0; i < 1000; i++) {
        console.log('waiting...');
      }
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




function onReceiveDoGChunkResult(event) {
  //First update the canvas with the chunk image data.
  main_canvas_context.putImageData(
    event.chunkImageData,
    chunk_boundaries[current_chunk_index].x1,
    chunk_boundaries[current_chunk_index].y1
  );


  //Increment the chunk counter and check if all the chunks have been 
  //calculated already
  current_chunk_index++;
  if (current_chunk_index < chunk_boundaries.length) {

    //There are still chunks left in the image to calculate.


    //Send another chunk to the background thread to be blurred.
    workerGetDoGChunk(
      background_thread,
      chunk_boundaries[current_chunk_index],
    );
  }
  else {

    //All the chunks in the image have been blurred.


    //Get the completed image_2d from the background thread.
    workerGetOutputImage2D(background_thread);
  }
}




function onReceiveBlurredImage2DResult(event) {

  //Add the image_2d to the image stack.
  scale_space[current_octave_index].gaussians.push(event.image2D);


  //Add the main canvas image to the stack of gaussians
  addMainCanvasImageToGaussianStackContainer();


  //Is this the last image in the stack?
  current_scale_level_index++;
  if (current_scale_level_index < SCALE_LEVELS + 3) {

    //There are still more images in the stack to blur. So update the 
    //worker's blur target image to the image that we just got back.
    workerSetTargetImage2D(background_thread, event.image2D);


    //Reset the chunk index so that it can start blurring from the 
    //first chunk. The chunk boundaries should still remain the same
    //since the image dimensions shouldn't change yet.
    current_chunk_index = 0;


    //And now apply the incremental blur to this new image.
    workerGetBlurredChunk(
      background_thread,
      chunk_boundaries[current_chunk_index],
      incremental_sigmas[current_scale_level_index]
    );
  }
  else {

    //This is the last image in the stack.
    current_octave_index++;
    if (current_octave_index < MAX_OCTAVES) {

      //There are still more octaves left to process. So Take the image
      //that's 2 images left from the end of the stack and downsample 
      //this image by 2. Incidentally, due to the way javascript arrays
      //work, `length - 3` accesses the 3rd element from the end of the
      //list, which is 2 elements from the end of the list and is the 
      //element we need. It might be coincidental that SCALE levels will
      //give the index for this image, since we +3 to get the length of
      //the `gaussians` stack.
      const downsampled_image_2d = image2DLinearDownsample2x(
        scale_space[current_octave_index - 1].gaussians[SCALE_LEVELS]
      );


      //Update the worker's blur target image to the newly resampled image.
      workerSetTargetImage2D(background_thread, downsampled_image_2d);


      //Recalculate the chunk boundaries for this new image. Reset the
      //Chunk counter and set the scale level to 1 since the image is
      //already blurred and we want to incrementally blur the following
      //images.
      const [width, height] = getImage2DDimensions(downsampled_image_2d);
      chunk_boundaries = getImageChunkBoundaries(width, height, CHUNK_SIZE);
      current_chunk_index = 0;
      current_scale_level_index = 1;


      //Update the main canvas
      main_canvas.height = height;
      main_canvas.width = width;
      main_canvas_context.putImageData(image2DToImageData(downsampled_image_2d), 0, 0);


      //Add the newly downsampled image to the stack of gaussians div.
      addMainCanvasImageToGaussianStackContainer();


      //Add the newly downsampled image to the stack of gaussians to
      //form the first image in the octave.
      scale_space[current_octave_index].gaussians.push(downsampled_image_2d);



      //Apply the incremental blur to this new image.
      workerGetBlurredChunk(
        background_thread,
        chunk_boundaries[current_chunk_index],
        incremental_sigmas[current_scale_level_index]
      );
    }
    else {

      //There are no more octaves to process, check the current 
      //state of the system.
      if (state === State.GENERATE_GAUSSIAN_PYRAMID) {

        //Finished generating the gaussian pyramid, now it's time to
        //generate the difference of gaussian pyramid. Update the state.
        state = State.GENERATE_DOG_PYRAMID;


        //Reset all counter variables and begin calculating the difference
        //of gaussians.
        current_octave_index = 0;
        current_scale_level_index = 0;
        current_chunk_index = 0;


        //Set the main canvas image to the first gaussian image.
        const [width, height] = getImage2DDimensions(scale_space[current_octave_index].gaussians[current_scale_level_index]);
        main_canvas.width = width;
        main_canvas.height = height;
        const image_data = image2DToImageData(scale_space[current_octave_index].gaussians[current_scale_level_index]);
        main_canvas_context.putImageData(image_data, 0, 0);


        //Recalculate chunk boundaries for the DoG algorithm.
        chunk_boundaries = getImageChunkBoundaries(width, height, CHUNK_SIZE);


        //Set the background thread's target images to the gaussian images of
        //the first octave.
        workerSetDoGTargets(background_thread, [
          scale_space[current_octave_index].gaussians[current_scale_level_index],
          scale_space[current_octave_index].gaussians[current_scale_level_index + 1],
        ]);


        //Calculate the difference of gaussians
        workerGetDoGChunk(background_thread, chunk_boundaries[current_chunk_index]);
      }
    }
  }
}




function onReceiveDoGImage2DResult(event) {

  //Add the image_2d to the image stack.
  scale_space[current_octave_index].differenceOfGaussians.push(event.image2D);


  //Update the image in the main canvas
  //main_canvas_context.putImageData(
  //  image2DToImageData(normalizeImage2D(event.image2D)),
  //  0, 0
  //);
  main_canvas_context.putImageData(
    convertDoGImage2DToImageData(event.image2D),
    0, 0
  );


  //Add main canvas image to the DoG stack containers
  addMainCanvasImageToDoGStackContainer();


  //Is this the last image in the stack?
  current_scale_level_index++;
  if (current_scale_level_index < SCALE_LEVELS + 2) {

    //There are still more images in the stack to compute the difference
    //of gaussians for, so update the worker's image pair to the next
    //set of images to compute.
    workerSetDoGTargets(
      background_thread,
      [
        scale_space[current_octave_index].gaussians[current_scale_level_index],
        scale_space[current_octave_index].gaussians[current_scale_level_index + 1]
      ]
    );


    //Reset the chunk index so that it can start computing the difference
    //of gaussians from the first chunk again. The chunk boundaries should
    //still remain the same since the image dimensions shouldn't change yet
    current_chunk_index = 0;


    //Now compute the difference of gaussian for this new image.
    workerGetDoGChunk(background_thread, chunk_boundaries[current_chunk_index]);
  }
  else {

    //This is the last image in the stack.
    current_octave_index++;
    if (current_octave_index < MAX_OCTAVES) {
      //There are still more octaves left to process, so reset the scale
      //space index to 0.
      current_scale_level_index = 0;


      //Reset the chunk index so it can start computing the difference of
      //gaussians from the first chunk again.
      current_chunk_index = 0;


      //Update the main canvas with the new image from the new octave.
      const [width, height] = getImage2DDimensions(scale_space[current_octave_index].gaussians[current_scale_level_index]);
      main_canvas.width = width;
      main_canvas.height = height;
      const image_data = image2DToImageData(scale_space[current_octave_index].gaussians[current_scale_level_index]);
      main_canvas_context.putImageData(image_data, 0, 0);


      //Recalculate the chunk boundaries since we're now working with
      //a downsized image.
      chunk_boundaries = getImageChunkBoundaries(width, height, CHUNK_SIZE);


      //Update the worker's image pair to the next set of images to compute
      workerSetDoGTargets(background_thread, [
        scale_space[current_octave_index].gaussians[current_scale_level_index],
        scale_space[current_octave_index].gaussians[current_scale_level_index + 1]
      ]);


      //Start calculating the difference of gaussians again.
      workerGetDoGChunk(background_thread, chunk_boundaries[current_chunk_index]);

    }
    else {

      //There are no more octaves to process, check the current state
      //of the system.
      if (state === State.GENERATE_DOG_PYRAMID) {

        //Finished generating the DoG pyramid, now it's time to find
        //local extrema within the DoG layers. Update the state.
        state = State.DETECT_LOCAL_EXTREMA;


        //Reset all counter variables and begin detection of local extrema.
        current_octave_index = 0;
        current_scale_level_index = 0;
        current_chunk_index = 0;


        //Set the main canvas image to the second dog_image.
        const [width, height] = getImage2DDimensions(scale_space[current_octave_index].differenceOfGaussians[current_scale_level_index + 1]);
        main_canvas.width = width;
        main_canvas.height = height;
        const image_data = image2DToImageData(scale_space[current_octave_index].differenceOfGaussians[current_scale_level_index + 1]);
        main_canvas_context.putImageData(image_data, 0, 0);


        //Recalculate the chunk boundaries for the detection algorithm
        chunk_boundaries = getImageChunkBoundaries(width, height, CHUNK_SIZE);


        //Set the background thread's target images to the DoG images of the
        //first octave.
        workerSetDetectionTargets(background_thread, [
          scale_space[current_octave_index].differenceOfGaussians[current_scale_level_index],
          scale_space[current_octave_index].differenceOfGaussians[current_scale_level_index + 1],
          scale_space[current_octave_index].differenceOfGaussians[current_scale_level_index + 2],
        ]);


        //Run the detection algorithm
        //workerGetPotentialKeypointsChunk(background_thread, chunk_boundaries[current_chunk_index]);
        workerGetPotentialKeypoints(background_thread);
      }
    }
  }
}








//------------------------------------------------------------------------------




function addMainCanvasImageToGaussianStackContainer() {
  const canvas = document.createElement('canvas');
  canvas.height = main_canvas.height;
  canvas.width = main_canvas.width;
  canvas.getContext('2d').putImageData(main_canvas_context.getImageData(0, 0, main_canvas.width, main_canvas.height), 0, 0);


  document.getElementById(`octave-${current_octave_index + 1}-gaussian-stack-container`).append(canvas);
}




function addMainCanvasImageToDoGStackContainer() {
  const canvas = document.createElement('canvas');
  canvas.height = main_canvas.height;
  canvas.width = main_canvas.width;
  canvas.getContext('2d').putImageData(main_canvas_context.getImageData(0, 0, main_canvas.width, main_canvas.height), 0, 0);


  document.getElementById(`octave-${current_octave_index + 1}-dog-stack-container`).append(canvas);
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


  //Set the current state of the main thread.
  state = State.GENERATE_GAUSSIAN_PYRAMID;


  //Generate a list of gaussian sigma values to incrementally blur our
  //input images with.
  incremental_sigmas = generateGaussianKernels(INITIAL_SIGMA, SCALE_LEVELS);
  console.log(incremental_sigmas);


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




function generateGaussianKernels(sigma, scale_levels) {
  /**
   * GENERATING THE BLUR SIGMAS
   * 
   * An octave appears to be a collection of images where the blur applied
   * in the stack of images goes from `sigma` to `2 * sigma`.
   * 
   * 
   * If `s` defines the scale level of the octave, then each octave needs
   * to produce `s + 3` number of images for the Gaussian stack. This is
   * because 1 image will be lost when calculating the difference of 
   * Gaussians because it takes 2 adjacent gaussian images and calculates
   * the difference across the octave. So if there are 6 images in the 
   * gaussian stack, it'll produce 5 images in the DoG stack.
   * 
   * 
   * The DoG stack will then contain `s+2` images. The extra 2 images
   * are used to pad the first and last layer in the DoG stack since 
   * the extrema detection phase involves taking a 3x3x3 scan of adjacent
   * layers for local maxima and minima. Having the extra layers allows
   * the first and last layers to be properly scanned for potential 
   * features.
   * 
   * 
   * Since the blur is applied incrementally on the previous blurred 
   * image, `sigma^2 = sigma_1^2 + sigma_2^2` can be used to determine
   * what the sigma value needed to acheive a specified blur on that
   * image in the stack is.
   * 
   * 
   * `k = 2 ^ (1 / s)` is used to determine the constant factor between
   * each gaussian blurred image. 
   * 
   * 
   * For the stack of blurred images, the first image has a blur of `sigma`.
   * The second image has a blur of `k * sigma`. The third image has a blur
   * of `k * (k * sigma)` which is the same as `k^2 * sigma`. The fourth has
   * `k * (k * (k * sigma))` which is the same as `k^3 * sigma`, and so on.
   * 
   * 
   * FULL DISCLOSURE
   *
   * I still can't wrap my head around why this part of the algorithm is 
   * implemented like this. I spent an entire day trying to figure this part
   * out and I feel as though I've only understood a portion of it. What I've
   * written above is my understanding of it so far based on my research, but I haven't
   * been able to gain an intuitive understanding of it like I normally would.
   * But in the interest of time, I feel I need to move on with the rest of the
   * implementation so I could have something semi-working by the time I submit 
   * this project.
   */
  const images_per_octave = scale_levels + 3;
  const k = Math.pow(2, 1.0 / scale_levels);
  const gaussian_kernels = [];


  gaussian_kernels.push(sigma);


  for (let i = 1; i < images_per_octave; i++) {
    const previous_sigma = Math.pow(k, i - 1) * sigma;
    const total_sigma = k * previous_sigma;


    gaussian_kernels.push(Math.sqrt(Math.pow(total_sigma, 2) - Math.pow(previous_sigma, 2)));
  }


  return gaussian_kernels;
}