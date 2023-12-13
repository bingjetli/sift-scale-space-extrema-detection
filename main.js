//@ts-nocheck
'use-strict';

import { generateKernelSizeFromSigma } from './src/gaussian-blur.js';
import { calculateExpandedChunkOffset, getImageChunkBoundaries, getKernelExpandedImageChunkBoundary, toImageDataCorners } from './src/image.js';
import { WorkerMessageTypes, workerCalculateDogChunk, workerGaussianBlurChunk } from './src/worker.js';

/**
 * REQUIREMENTS
 * This project requires the latest version of a Chromium-based browser
 * to support `.showOpenFilePicker()`.
 * 
 * As well as a local http server to serve the page to support Worker
 * threads as well as ES Modules.
 */




window.onload = _ => {
  //Check if the browser supports web-workers.
  if (window.Worker) {
    //The browser supports web-workers, we can proceed.




    //Configuration variables
    let chunk_boundaries = null;
    let current_chunk_index = -1;
    const chunk_size = 128;
    let sigma = 3;
    let kernel_size = generateKernelSizeFromSigma(sigma);
    const octaves = 2;
    const blurred_image_data_stack = [];




    const background_thread = new Worker('background.js', { type: 'module' });
    background_thread.onmessage = e => {
      switch (e.data.type) {
        case WorkerMessageTypes.GAUSSIAN_BLUR_RESULT:
          canvas_1_context.putImageData(
            e.data.data,
            chunk_boundaries[current_chunk_index].x1,
            chunk_boundaries[current_chunk_index].y1,
          );


          current_chunk_index++;
          if (current_chunk_index < chunk_boundaries.length) {
            //Prepare another chunk to send.
            const expanded_chunk_boundary = getKernelExpandedImageChunkBoundary(
              kernel_size,
              chunk_boundaries[current_chunk_index],
              canvas_1.height,
              canvas_1.width
            );


            const chunk_boundary_offset = calculateExpandedChunkOffset(
              chunk_boundaries[current_chunk_index],
              expanded_chunk_boundary
            );


            //Send the first chunk over to the background thread for processing.
            const { left, top, width, height } = toImageDataCorners(
              expanded_chunk_boundary
            );
            workerGaussianBlurChunk(
              background_thread,
              canvas_1_context.getImageData(left, top, width, height),
              chunk_boundary_offset,
              kernel_size,
              sigma,
              chunk_boundaries[current_chunk_index]
            );


            const c = toImageDataCorners(chunk_boundaries[current_chunk_index]);
            canvas_2.width = c.width;
            canvas_2.height = c.height;
            canvas_2_context.putImageData(
              canvas_1_context.getImageData(c.left, c.top, c.width, c.height),
              0, 0
            );
          }


          //console.log(`${current_chunk_index} / ${chunk_boundaries.length}`);
          else if (current_chunk_index >= chunk_boundaries.length) {
            blurred_image_data_stack.push(canvas_1_context.getImageData(0, 0, canvas_1.width, canvas_2.height));
            addToBlurredImagesContainer(canvas_1_context.getImageData(0, 0, canvas_1.width, canvas_1.height));


            if (blurred_image_data_stack.length < octaves) {
              //This means that we're still building the stack of gaussian
              //blurred images, so double the sigma and regenerate the 
              //kernel.
              sigma = sigma * 2;
              kernel_size = generateKernelSizeFromSigma(sigma);


              //Reset the current chunk index and prepare another chunk to send.
              current_chunk_index = 0;
              const expanded_chunk_boundary = getKernelExpandedImageChunkBoundary(
                kernel_size,
                chunk_boundaries[current_chunk_index],
                canvas_1.height,
                canvas_1.width
              );


              const chunk_boundary_offset = calculateExpandedChunkOffset(
                chunk_boundaries[current_chunk_index],
                expanded_chunk_boundary
              );


              //Send the first chunk over to the background thread for processing.
              const { left, top, width, height } = toImageDataCorners(
                expanded_chunk_boundary
              );
              workerGaussianBlurChunk(
                background_thread,
                canvas_1_context.getImageData(left, top, width, height),
                chunk_boundary_offset,
                kernel_size,
                sigma,
                chunk_boundaries[current_chunk_index]
              );
            }


            else {
              console.log('time to compute difference of gaussians');
              //Reset the current chunk index and prepare another chunk to send.
              current_chunk_index = 0;
              const { left, top, width, height } = toImageDataCorners(
                chunk_boundaries[current_chunk_index]
              );
              const blurred_image_canvases = document.getElementById('blurred-images-container').children;
              workerCalculateDogChunk(background_thread, [
                blurred_image_canvases[0].getContext('2d').getImageData(left, top, width, height),
                blurred_image_canvases[1].getContext('2d').getImageData(left, top, width, height),
              ]);
            }

          }
          break;


        case WorkerMessageTypes.DIFFERENCE_OF_GAUSSIAN_RESULT:
          canvas_1_context.putImageData(
            e.data.data,
            chunk_boundaries[current_chunk_index].x1,
            chunk_boundaries[current_chunk_index].y1,
          );


          current_chunk_index++;
          if (current_chunk_index < chunk_boundaries.length) {
            const { left, top, width, height } = toImageDataCorners(
              chunk_boundaries[current_chunk_index]
            );
            const blurred_image_canvases = document.getElementById('blurred-images-container').children;
            workerCalculateDogChunk(background_thread, [
              blurred_image_canvases[0].getContext('2d').getImageData(left, top, width, height),
              blurred_image_canvases[1].getContext('2d').getImageData(left, top, width, height),
            ]);
          }
          break;


        default:
          console.log('main.js received the following :');
          console.log(e.data);
      }
    };




    //Retreive handles to the canvas elements.
    const canvas_1 = document.getElementById('canvas-1');
    const canvas_2 = document.getElementById('canvas-2');


    //Along with their 2d contexts.
    const canvas_1_context = canvas_1.getContext('2d', { willReadFrequently: true });
    const canvas_2_context = canvas_2.getContext('2d');


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
        //Resize the canvas dimensions to the image dimensions.
        canvas_1.width = image_element.width;
        canvas_1.height = image_element.height;

        canvas_2.width = image_element.width;
        canvas_2.height = image_element.height;


        //When the image loads, draw the image on the canvas and clean
        //up the resources used by `.createObjectURL()`.
        canvas_1_context.drawImage(image_element, 0, 0);
        URL.revokeObjectURL(image_url);




        //Now, the image is loaded onto the canvas and I can begin processing
        //the image.

        //Start by calculating the chunk boundaries for the image. This
        //will be used to split the image up into chunks in order to send
        //to the background thread for processing.
        chunk_boundaries = getImageChunkBoundaries(
          canvas_1.width,
          canvas_1.height,
          chunk_size
        );


        //Also update the current chunk cursor now that the chunk boundaries
        //are initialized.
        current_chunk_index = 0;


        const expanded_chunk_boundary = getKernelExpandedImageChunkBoundary(
          kernel_size,
          chunk_boundaries[current_chunk_index],
          canvas_1.height,
          canvas_1.width
        );


        const chunk_boundary_offset = calculateExpandedChunkOffset(
          chunk_boundaries[current_chunk_index],
          expanded_chunk_boundary
        );


        //Send the first chunk over to the background thread for processing.
        const { left, top, width, height } = toImageDataCorners(
          expanded_chunk_boundary
        );
        workerGaussianBlurChunk(
          background_thread,
          canvas_1_context.getImageData(left, top, width, height),
          chunk_boundary_offset,
          kernel_size,
          sigma,
          chunk_boundaries[current_chunk_index]
        );


        const c = toImageDataCorners(chunk_boundaries[current_chunk_index]);
        canvas_2.width = c.width;
        canvas_2.height = c.height;
        canvas_2_context.putImageData(
          canvas_1_context.getImageData(c.left, c.top, c.width, c.height),
          0, 0
        );
      };
    };
  }
  else {
    console.log('Your browser doesn\'t support web workers.');
  }
};




function addToBlurredImagesContainer(image_data) {
  const canvas = document.createElement('canvas');
  canvas.height = image_data.height;
  canvas.width = image_data.width;
  canvas.getContext('2d').putImageData(image_data, 0, 0);


  document.getElementById('blurred-images-container').append(canvas);
}