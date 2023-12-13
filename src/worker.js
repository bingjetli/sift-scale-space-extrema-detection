export const WorkerMessageTypes = {
  APPLY_GAUSSIAN_BLUR: 'apply-gaussian-blur',
  GAUSSIAN_BLUR_RESULT: 'gaussian-blur-result',
  CALCULATE_DIFFERENCE_OF_GAUSSIAN: 'calculate-difference-of-gaussians',
  DIFFERENCE_OF_GAUSSIAN_RESULT: 'difference-of-gaussian-result'
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