import { computeDoGChunk2D, convertDoGImage2DToImageData } from './src/dog.js';
import { blurChunk2D } from './src/gaussian-blur.js';
import { ImageDataEx } from './src/image-data-ex.js';
import { createBlankImage2D, image2DToImageData, normalizeImage2D } from './src/image2d.js';
import { getPotentialKeypoints } from './src/keypoints.js';
import { WorkerMessageTypes } from './src/worker.js';

console.log('background.js is running');

/**
 * Experiment to test whether messages are queued between threads.
 * 
 * Conclusion : Messages are queued and executed sequentially.
 */
//for (let i = 0; i < 10; i++) {
//  postMessage({
//    type: WorkerMessageTypes.MESSAGE_QUEUE_TEST,
//    data: i,
//  });
//}


let target_image_2d = null;
let target_dog_pair_images_2d = null;
let target_detection_image_trio_2d = null;
let output_image_2d = null;

onmessage = e => {
  switch (e.data.type) {
    case WorkerMessageTypes.GET_OUTPUT_IMAGE_2D:
      postMessage({
        type: WorkerMessageTypes.OUTPUT_IMAGE_2D_RESULT,
        image2D: output_image_2d
      });
      break;




    case WorkerMessageTypes.SET_TARGET_IMAGE_2D:
      target_image_2d = e.data.targetImage2D;


      //console.log('`target_image_2d` set to the following :');
      //console.log(target_image_2d);
      console.log('Background Thread : New target image set.');


      //Create a new output image based on the input dimensions.
      output_image_2d = createBlankImage2D(target_image_2d.length, target_image_2d[0].length);


      //Respond to the main thread.
      postMessage({ type: WorkerMessageTypes.TARGET_IMAGE_2D_IS_SET });
      break;




    case WorkerMessageTypes.SET_DOG_PAIR_IMAGES_2D:
      target_dog_pair_images_2d = e.data.targetImagePairs;


      console.log('Background Thread : DoG target images set.');
      console.log(target_dog_pair_images_2d);


      //Create a new output image based on the input dimensions.
      output_image_2d = createBlankImage2D(target_dog_pair_images_2d[0].length, target_dog_pair_images_2d[0][0].length);


      //Respond to the main thread.
      postMessage({ type: WorkerMessageTypes.DOG_PAIR_IMAGES_2D_IS_SET });
      break;




    case WorkerMessageTypes.SET_DETECTION_IMAGES_2D:
      target_detection_image_trio_2d = e.data.targetImageTrio;


      console.log('Background Thread : Detection target images set.');
      console.log(target_detection_image_trio_2d);


      //Create a new output image based on the input dimensions.
      output_image_2d = createBlankImage2D(target_detection_image_trio_2d[0].length, target_detection_image_trio_2d[0][0].length);


      //Respond to the main thread.
      postMessage({ type: WorkerMessageTypes.DETECTION_IMAGES_2D_IS_SET });
      break;




    case WorkerMessageTypes.GET_BLURRED_CHUNK:

      //Mutate the output_image_2d, and return a copy of the chunk it
      //blurred.
      const blurred_chunk_img2d = blurChunk2D(
        target_image_2d,
        output_image_2d,
        e.data.chunkBoundary,
        e.data.sigma
      );


      //Convert image_2d chunk to ImageData, and return that result
      //back to the main thread. Also return the sigma value back
      //to the main thread so that it can be used to blur again.
      postMessage({
        type: WorkerMessageTypes.BLURRED_CHUNK_RESULT,
        chunkImageData: image2DToImageData(blurred_chunk_img2d),
        sigma: e.data.sigma
      });
      break;

    case WorkerMessageTypes.GET_DOG_CHUNK:

      //Mutate the output_image_2d, and return a copy of the chunk it
      //calculated for the difference of gaussians.
      const dog_chunk_img2d = computeDoGChunk2D(
        target_dog_pair_images_2d[0],
        target_dog_pair_images_2d[1],
        output_image_2d,
        e.data.chunkBoundary
      );


      //Normalize the image_2d chunk, convert it to an ImageData and 
      //return that result back to the main thread.
      //postMessage({
      //  type: WorkerMessageTypes.DOG_CHUNK_RESULT,
      //  chunkImageData: image2DToImageData(normalizeImage2D(dog_chunk_img2d)),
      //});
      postMessage({
        type: WorkerMessageTypes.DOG_CHUNK_RESULT,
        chunkImageData: convertDoGImage2DToImageData(dog_chunk_img2d),
      });
      break;



    case WorkerMessageTypes.GET_POTENTIAL_KEYPOINTS:
      //By this point, the target images for this detection algorithm
      //should have been set already. Since, we are scanning in a 3x3x3
      //cube, we shouldn't need to chunk the image. It's also a bit of a 
      //hassle to calculate all the correct points to sample if we continue
      //to use chunking here. So therefore, we sample the entire image.
      getPotentialKeypoints(target_detection_image_trio_2d);
      break;




    default:
      console.log('background.js received the following :');
      console.log(e.data);
  }
};



