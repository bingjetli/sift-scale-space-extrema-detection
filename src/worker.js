export const WorkerMessageTypes = {
  //APPLY_GAUSSIAN_BLUR: 'apply-gaussian-blur',
  //GAUSSIAN_BLUR_RESULT: 'gaussian-blur-result',
  //CALCULATE_DIFFERENCE_OF_GAUSSIAN: 'calculate-difference-of-gaussians',
  //DIFFERENCE_OF_GAUSSIAN_RESULT: 'difference-of-gaussian-result',

  //SET_TARGET_IMAGE_2D: 'set-target-image-2d',
  //TARGET_IMAGE_2D_IS_SET: 'target-image-2d-is-set',

  //GET_BLURRED_CHUNK: 'get-blurred-chunk',
  //BLURRED_CHUNK_RESULT: 'blurred-chunk-result',

  //GET_OUTPUT_IMAGE_2D: 'get-output-image-2d',
  //OUTPUT_IMAGE_2D_RESULT: 'output-image-2d-result',

  //GET_DOG_CHUNK: 'get-dog-chunk',
  //DOG_CHUNK_RESULT: 'dog-chunk-result',

  //SET_DOG_PAIR_IMAGES_2D: 'set-dog-pair-images-2d',
  //DOG_PAIR_IMAGES_2D_IS_SET: 'dog-pair-images-2d-is-set',

  //SET_DETECTION_IMAGES_2D: 'set-detection-images-2d',
  //DETECTION_IMAGES_2D_IS_SET: 'detection-images-2d-is-set',

  //GET_POTENTIAL_KEYPOINTS_CHUNK: 'get-potential-keypoints-chunk',
  //GET_POTENTIAL_KEYPOINTS: 'get-potential-keypoints',
  //POTENTIAL_KEYPOINTS_CHUNK_RESULT: 'potential-keypoints-chunk-result',

  //MESSAGE_QUEUE_TEST: 'message-queue-test',


  //New Message Architecture
  COMPUTE_GAUSSIAN_SCALE_SPACE: 'compute-gaussian-scale-space',
  RECEIVED_GAUSSIAN_SCALE_SPACE: 'received-gaussian-scale-space',
  RECEIVED_GAUSSIAN_BLURRED_CHUNK: 'received-gaussian-blurred-chunk',
  RECEIVED_GAUSSIAN_BLURRED_IMAGE: 'received-gaussian-blurred-image',

  COMPUTE_DIFFERENCE_OF_GAUSSIANS: 'compute-difference-of-gaussians',
  RECEIVED_DIFFERENCE_OF_GAUSSIAN_IMAGE: 'received-difference-of-gaussian-image',
  RECEIVED_DIFFERENCE_OF_GAUSSIANS: 'received-difference-of-gaussians',
};




//export function workerGaussianBlurChunk(
//  worker,
//  image_data,
//  chunk_offsets,
//  kernel_size,
//  sigma,
//  chunk_boundary,
//) {
//  worker.postMessage({
//    type: WorkerMessageTypes.APPLY_GAUSSIAN_BLUR,
//    image_data: image_data,
//    chunk_offsets: chunk_offsets,
//    kernel_size: kernel_size,
//    sigma: sigma,
//    chunk_boundary: chunk_boundary
//  });
//}
//
//
//
//
//export function workerCalculateDogChunk(
//  worker,
//  images,
//) {
//  worker.postMessage({
//    type: WorkerMessageTypes.CALCULATE_DIFFERENCE_OF_GAUSSIAN,
//    images: images
//  });
//}
//
//
//
//
//export function workerSetTargetImage2D(worker, target_image_2d) {
//  worker.postMessage({
//    type: WorkerMessageTypes.SET_TARGET_IMAGE_2D,
//    targetImage2D: target_image_2d
//  });
//}
//
//
//
//
//export function workerGetBlurredChunk(worker, chunk_boundary, sigma) {
//  worker.postMessage({
//    type: WorkerMessageTypes.GET_BLURRED_CHUNK,
//    chunkBoundary: chunk_boundary,
//    sigma: sigma
//  });
//}
//
//
//
//
//export function workerGetOutputImage2D(worker) {
//  worker.postMessage({
//    type: WorkerMessageTypes.GET_OUTPUT_IMAGE_2D,
//  });
//}
//
//
//
//
//export function workerGetDoGChunk(worker, chunk_boundary) {
//  worker.postMessage({
//    type: WorkerMessageTypes.GET_DOG_CHUNK,
//    chunkBoundary: chunk_boundary
//  });
//}
//
//
//
//export function workerSetDoGTargets(worker, dog_image_pair) {
//  worker.postMessage({
//    type: WorkerMessageTypes.SET_DOG_PAIR_IMAGES_2D,
//    targetImagePairs: dog_image_pair,
//  });
//}
//
//
//
//
//export function workerSetDetectionTargets(worker, image_trio) {
//  worker.postMessage({
//    type: WorkerMessageTypes.SET_DETECTION_IMAGES_2D,
//    targetImageTrio: image_trio
//  });
//}
//
//
//
//
//export function workerGetPotentialKeypointsChunk(worker, chunk_boundary) {
//  worker.postMessage({
//    type: WorkerMessageTypes.GET_POTENTIAL_KEYPOINTS_CHUNK,
//    chunkBoundary: chunk_boundary
//  });
//}
//
//
//
//export function workerGetPotentialKeypoints(worker) {
//  worker.postMessage({
//    type: WorkerMessageTypes.GET_POTENTIAL_KEYPOINTS,
//  });
//}




//New architecture
export function workerComputeGaussianScaleSpace(
  worker,
  {
    input_image,
    number_of_octaves = 4,
    scales_per_octave = 3,
    min_blur_level = 0.8,
    assumed_blur = 0.5,
    chunk_size = 32,
  }
) {
  worker.postMessage({
    type: WorkerMessageTypes.COMPUTE_GAUSSIAN_SCALE_SPACE,
    inputImage: input_image,
    numberOfOctaves: number_of_octaves,
    scalesPerOctave: scales_per_octave,
    minBlurLevel: min_blur_level,
    assumedBlur: assumed_blur,
    chunkSize: chunk_size,
  });
}




export function workerComputeDifferenceOfGaussians(worker, scale_space) {
  worker.postMessage({
    type: WorkerMessageTypes.COMPUTE_DIFFERENCE_OF_GAUSSIANS,
    scaleSpace: scale_space,
  });
}