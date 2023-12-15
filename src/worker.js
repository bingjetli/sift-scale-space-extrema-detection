export const WorkerMessageTypes = {
  APPLY_GAUSSIAN_BLUR: 'apply-gaussian-blur',
  GAUSSIAN_BLUR_RESULT: 'gaussian-blur-result',
  CALCULATE_DIFFERENCE_OF_GAUSSIAN: 'calculate-difference-of-gaussians',
  DIFFERENCE_OF_GAUSSIAN_RESULT: 'difference-of-gaussian-result',
  SET_TARGET_IMAGE_2D: 'set-target-image-2d',
  TARGET_IMAGE_2D_IS_SET: 'target-image-2d-is-set',
  GET_BLURRED_CHUNK: 'get-blurred-chunk',
  BLURRED_CHUNK_RESULT: 'blurred-chunk-result',
  GET_OUTPUT_IMAGE_2D: 'get-output-image-2d',
  OUTPUT_IMAGE_2D_RESULT: 'output-image-2d-result',
};




export function workerGaussianBlurChunk(
  worker,
  image_data,
  chunk_offsets,
  kernel_size,
  sigma,
  chunk_boundary,
) {
  worker.postMessage({
    type: WorkerMessageTypes.APPLY_GAUSSIAN_BLUR,
    image_data: image_data,
    chunk_offsets: chunk_offsets,
    kernel_size: kernel_size,
    sigma: sigma,
    chunk_boundary: chunk_boundary
  });
}




export function workerCalculateDogChunk(
  worker,
  images,
) {
  worker.postMessage({
    type: WorkerMessageTypes.CALCULATE_DIFFERENCE_OF_GAUSSIAN,
    images: images
  });
}




export function workerSetTargetImage2D(worker, target_image_2d) {
  worker.postMessage({
    type: WorkerMessageTypes.SET_TARGET_IMAGE_2D,
    targetImage2D: target_image_2d
  });
}




export function workerGetBlurredChunk(worker, chunk_boundary, sigma) {
  worker.postMessage({
    type: WorkerMessageTypes.GET_BLURRED_CHUNK,
    chunkBoundary: chunk_boundary,
    sigma: sigma
  });
}




export function workerGetOutputImage2D(worker) {
  worker.postMessage({
    type: WorkerMessageTypes.GET_OUTPUT_IMAGE_2D,
  });
}