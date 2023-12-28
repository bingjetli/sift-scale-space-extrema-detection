export const WorkerMessageTypes = {
  COMPUTE_GAUSSIAN_SCALE_SPACE: 'compute-gaussian-scale-space',
  RECEIVED_GAUSSIAN_SCALE_SPACE: 'received-gaussian-scale-space',
  RECEIVED_GAUSSIAN_BLURRED_CHUNK: 'received-gaussian-blurred-chunk',
  RECEIVED_GAUSSIAN_BLURRED_IMAGE: 'received-gaussian-blurred-image',

  COMPUTE_DIFFERENCE_OF_GAUSSIANS: 'compute-difference-of-gaussians',
  RECEIVED_DIFFERENCE_OF_GAUSSIAN_IMAGE: 'received-difference-of-gaussian-image',
  RECEIVED_DIFFERENCE_OF_GAUSSIANS: 'received-difference-of-gaussians',
};




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