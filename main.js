//@ts-nocheck
'use strict';

import { ImageUtils_convertImageDataToMatrix2D, ImageUtils_convertMatrix2DToImageData } from './src/image-utils.js';
import { Matrix2D_getDimensions } from './src/matrix2d.js';
import { WorkerMessageTypes, workerComputeDifferenceOfGaussians, workerComputeGaussianScaleSpace, workerFindCandidateKeypoints, workerRefineCandidateKeypoints } from './src/worker.js';

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
const MAX_OCTAVES = 5;
const SCALE_LEVELS = 3;
const INITIAL_BLUR = 0.8;

let input_image = null;
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

        //Cache a handle to the image dimensions.
        const _width = image_element.width;
        const _height = image_element.height;

        //Cache a handle to the main canvas and set the canvas dimensions.
        main_canvas = document.getElementById('main-canvas');
        main_canvas.width = _width * 2;
        main_canvas.height = _height * 2;


        //Cache a handle to the main canvas's context as well.
        main_canvas_context = main_canvas.getContext('2d');


        //When the image loads, draw the image on the main canvas
        //and clean up the resources used by `.createObjectURL()`.
        main_canvas_context.drawImage(image_element, 0, 0);
        URL.revokeObjectURL(image_url);


        //Convert the image to a grayscale Image2D array and draw it 
        //onto the main canvas.
        input_image = ImageUtils_convertImageDataToMatrix2D({
          imageData: main_canvas_context.getImageData(0, 0, _width, _height),
          convertToGrayscale: true,
          usePerceptualGrayscale: true,
          discardAlphaChannel: true,
        });
        main_canvas_context.putImageData(ImageUtils_convertMatrix2DToImageData(
          _width, _height, { grayChannelMatrix: input_image },
        ), 0, 0);


        //Now that the image is loaded, begin the SIFT algorithm by
        //generating the Gaussian Scale Space.
        workerComputeGaussianScaleSpace(background_thread, {
          input_image: input_image,
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


    case WorkerMessageTypes.RECEIVED_CANDIDATE_KEYPOINT_BASE_IMAGE:
      onReceiveCandidateKeypointBaseImage(event.data);
      break;


    case WorkerMessageTypes.RECEIVED_CANDIDATE_KEYPOINT_MARKER:
      onReceiveCandidateKeypointMarker(event.data);
      break;


    case WorkerMessageTypes.RECEIVED_CANDIDATE_KEYPOINTS:
      onReceiveCandidateKeypoints(event.data);
      break;


    case WorkerMessageTypes.RECEIVED_REFINED_KEYPOINTS:
      onReceivedRefinedKeypoints(event.data);
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


  //Clear the current canvas
  main_canvas_context.clearRect(0, 0, main_canvas.width, main_canvas.height);
}


function onReceiveGaussianScaleSpace({ scaleSpace }) {

  //Cache the resulting Gaussian scale space.
  gaussian_scale_space = scaleSpace;


  //Resize the main canvas to the first image in the scale space before
  //starting to compute the difference of Gaussians.
  const [_height, _width] = Matrix2D_getDimensions(scaleSpace[0][0].image);
  main_canvas.width = _width;
  main_canvas.height = _height;
  main_canvas_context.clearRect(0, 0, _width, _height);


  workerComputeDifferenceOfGaussians(background_thread, scaleSpace);
}


function onReceiveDifferenceOfGaussianImage({ imageData, octave }) {
  //Resize the main canvas according to the current octave image.
  if (main_canvas.width !== imageData.width) main_canvas.width = imageData.width;
  if (main_canvas.height !== imageData.height) main_canvas.height = imageData.height;


  //Update the main canvas image.
  main_canvas_context.putImageData(imageData, 0, 0);


  addMainCanvasImageToDoGStackContainer(octave);


  main_canvas_context.clearRect(0, 0, imageData.width, imageData.height);
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
    SCALE_LEVELS,
  );
}




function onReceiveCandidateKeypointImage({ imageData, octave }) {
  //Resize the main canvas according to the current octave image.
  //if (main_canvas.width !== imageData.width) main_canvas.width = imageData.width;
  //if (main_canvas.height !== imageData.height) main_canvas.height = imageData.height;


  //Update the main canvas image.
  //main_canvas_context.putImageData(imageData, 0, 0);


  addMainCanvasImageToCandidateKeypointsContainer(octave);
}





function onReceiveCandidateKeypointBaseImage({ imageData, octave }) {
  //Resize the main canvas according to the current octave image.
  if (main_canvas.width !== imageData.width) main_canvas.width = imageData.width;
  if (main_canvas.height !== imageData.height) main_canvas.height = imageData.height;


  //Update the main canvas image.
  main_canvas_context.putImageData(imageData, 0, 0);
}




function onReceiveCandidateKeypointMarker({ x, y, isLowContrast }) {

  main_canvas_context.fillStyle = isLowContrast ? '#f003' : 'yellow';
  main_canvas_context.fillRect(x - 1, y - 1, 3, 3);
}




function onReceiveCandidateKeypoints({ candidateKeypoints }) {
  workerRefineCandidateKeypoints(
    background_thread,
    difference_of_gaussians,
    candidateKeypoints,
    SCALE_LEVELS,
    MAX_OCTAVES,
    INITIAL_BLUR,
  );
}




function onReceivedRefinedKeypoints({ refinedKeypoints }) {

  //Resize the main canvas to the input image.
  const [_height, _width] = Matrix2D_getDimensions(input_image);
  main_canvas.width = _width;
  main_canvas.height = _height;


  //Repaint the main canvas with the input image.
  main_canvas_context.putImageData(ImageUtils_convertMatrix2DToImageData(
    _width,
    _height,
    { grayChannelMatrix: input_image },
  ), 0, 0);


  //Paint all the refined keypoints to the main canvas.
  main_canvas_context.strokeStyle = 'yellow';
  refinedKeypoints.forEach(keypoint => {
    main_canvas_context.beginPath();
    main_canvas_context.arc(
      keypoint.absoluteX,
      keypoint.absoluteY,
      keypoint.absoluteSigma,
      0,
      Math.PI * 2,
    );
    main_canvas_context.closePath();
    main_canvas_context.stroke();
  });

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