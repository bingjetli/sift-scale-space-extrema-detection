//@ts-nocheck
'use strict';


export const WorkerMessageTypes = {
  COMPUTE_GAUSSIAN_SCALE_SPACE: 'compute-gaussian-scale-space',
  RECEIVED_GAUSSIAN_SCALE_SPACE: 'received-gaussian-scale-space',
  RECEIVED_GAUSSIAN_BLURRED_CHUNK: 'received-gaussian-blurred-chunk',
  RECEIVED_GAUSSIAN_BLURRED_IMAGE: 'received-gaussian-blurred-image',

  COMPUTE_DIFFERENCE_OF_GAUSSIANS: 'compute-difference-of-gaussians',
  RECEIVED_DIFFERENCE_OF_GAUSSIANS: 'received-difference-of-gaussians',
  RECEIVED_DIFFERENCE_OF_GAUSSIAN_CHUNK: 'received-difference-of-gaussian-chunk',
  RECEIVED_DIFFERENCE_OF_GAUSSIAN_IMAGE: 'received-difference-of-gaussian-image',

  FIND_CANDIDATE_KEYPOINTS: 'find-candidate-keypoints',
  RECEIVED_CANDIDATE_KEYPOINT_IMAGE: 'received-candidate-keypoint-image',
  RECEIVED_CANDIDATE_KEYPOINT_BASE_IMAGE: 'received-candidate-keypoint-base-image',
  RECEIVED_CANDIDATE_KEYPOINT_MARKER: 'received-candidate-keypoint-marker',
  RECEIVED_CANDIDATE_KEYPOINTS: 'received-candidate-keypoints',

  REFINE_CANDIDATE_KEYPOINTS: 'refine-candidate-keypoints',
};




export function workerComputeGaussianScaleSpace(
  worker,
  {
    input_image,
    number_of_octaves = 5,
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




export function workerFindCandidateKeypoints(
  worker,
  difference_of_gaussians,
  octave_base_images,
  scales_per_octave
) {
  worker.postMessage({
    type: WorkerMessageTypes.FIND_CANDIDATE_KEYPOINTS,
    differenceOfGaussians: difference_of_gaussians,
    octaveBaseImages: octave_base_images,
    scalesPerOctave: scales_per_octave,
  });
}




export function workerRefineCandidateKeypoints(
  worker,
  difference_of_gaussians,
  candidate_keypoints,
  scales_per_octave,
  number_of_octaves,
  min_blur_level,
  min_interpixel_distance = 0.5,
) {
  worker.postMessage({
    type: WorkerMessageTypes.REFINE_CANDIDATE_KEYPOINTS,
    differenceOfGaussians: difference_of_gaussians,
    scalesPerOctave: scales_per_octave,
    candidateKeypoints: candidate_keypoints,
    numberOfOctaves: number_of_octaves,
    minInterpixelDistance: min_interpixel_distance,
    minBlurLevel: min_blur_level,
  });
}