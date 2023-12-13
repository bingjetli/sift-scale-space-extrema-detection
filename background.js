import { dogToImageData, subtractImageData } from './src/dog.js';
import { applyGaussianBlur } from './src/gaussian-blur.js';
import { WorkerMessageTypes } from './src/worker.js';

console.log('background.js is running');

onmessage = e => {
  switch (e.data.type) {
    case WorkerMessageTypes.APPLY_GAUSSIAN_BLUR:
      postMessage({
        type: WorkerMessageTypes.GAUSSIAN_BLUR_RESULT,
        data: applyGaussianBlur(
          e.data.image_data,
          e.data.kernel_size,
          e.data.sigma,
          e.data.chunk_offsets.x1,
          e.data.chunk_offsets.y1,
          e.data.chunk_offsets.x2,
          e.data.chunk_offsets.y2
        )
      });
      break;
    case WorkerMessageTypes.CALCULATE_DIFFERENCE_OF_GAUSSIAN:
      postMessage({
        type: WorkerMessageTypes.DIFFERENCE_OF_GAUSSIAN_RESULT,
        data: dogToImageData(subtractImageData(e.data.images[0], e.data.images[1]))
      });
      break;
    default:
      console.log('background.js received the following :');
      console.log(e.data);
  }
};