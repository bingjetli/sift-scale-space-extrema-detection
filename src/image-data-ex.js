//@ts-nocheck

export const ImageDataExColorSpace = {
  GRAYSCALE: 'grayscale',
  GRAYSCALE_ALPHA: 'grayscale-alpha',
  PERCEPTUAL_GRAYSCALE: 'perceptual-grayscale',
  PERCEPTUAL_GRAYSCALE_ALPHA: 'perceptual-grayscale-alpha',
  RGB: 'rgb',
  RGBA: 'rgba',
};




export class ImageDataEx {
  constructor(width = 0, height = 0, colorspace = ImageDataExColorSpace.GRAYSCALE) {
    this.width = width;
    this.height = height;
    this.colorspace = colorspace;
  }




  loadDataFrom(image_data, colorspace = this.colorspace) {

    //First, resize the image to the ImageData we're loading the image
    //from and update the colorspace value.
    this.width = image_data.width;
    this.height = image_data.height;
    this.colorspace = colorspace;


    //Then create an appropriately sized typed array to hold the data.
    switch (this.colorspace) {
      case ImageDataExColorSpace.RGBA:
        this.data = new Uint8Array(this.height * (this.width * 4));
        break;


      case ImageDataExColorSpace.RGB:
        this.data = new Uint8Array(this.height * (this.width * 3));
        break;


      case ImageDataExColorSpace.PERCEPTUAL_GRAYSCALE_ALPHA:
      case ImageDataExColorSpace.GRAYSCALE_ALPHA:
        this.data = new Uint8Array(this.height * (this.width * 2));
        break;


      case ImageDataExColorSpace.PERCEPTUAL_GRAYSCALE:
      default:
        this.data = new Uint8Array(this.width * this.height);
    }


    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {

        //No need to check outside bounds since this image should
        //be the same size as the ImageData we're trying to load
        //from.
        const image_data_pixel_index = y * (this.width * 4) + (x * 4);


        //Initialize a pixel index for this image.
        let pixel_index = -1;
        switch (this.colorspace) {
          case ImageDataExColorSpace.GRAYSCALE_ALPHA:

            //This is the same as `GRAYSCALE` except it has an alpha
            //channel, the alpha channel takes up an extra slot.
            pixel_index = y * (this.width * 2) + (x * 2);


            //Naive conversion of the image into grayscale.
            this.data[pixel_index] = (image_data.data[image_data_pixel_index] * 0.33) +
              (image_data.data[image_data_pixel_index + 1] * 0.33) +
              (image_data.data[image_data_pixel_index + 2] * 0.33);


            //Set the new image's alpha channel.
            this.data[pixel_index + 1] = image_data.data[image_data_pixel_index + 3];
            break;
          default:

            //The default colorspace is `GRAYSCALE`.
            pixel_index = y * this.width + x;


            //Naive conversion of the image into grayscale.
            this.data[pixel_index] = (image_data.data[image_data_pixel_index] * 0.33) +
              (image_data.data[image_data_pixel_index + 1] * 0.33) +
              (image_data.data[image_data_pixel_index + 2] * 0.33);
        }
      }
    }


    return this;
  }




  toImageData() {

    //Create the blank ImageData object
    const output = new OffscreenCanvas(this.width, this.height).getContext('2d').createImageData(this.width, this.height);


    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {

        const output_pixel_index = y * (this.width * 4) + (x * 4);


        let this_pixel_index = -1;
        let pixel_value = -1; //Only used for grayscale cases.
        switch (this.colorspace) {
          case ImageDataExColorSpace.RGBA:
            this_pixel_index = y * (this.width * 4) + (x * 4);


            output.data[output_pixel_index] = this.data[this_pixel_index];
            output.data[output_pixel_index + 1] = this.data[this_pixel_index + 1];
            output.data[output_pixel_index + 2] = this.data[this_pixel_index + 2];
            output.data[output_pixel_index + 3] = this.data[this_pixel_index + 3];
            break;


          case ImageDataExColorSpace.RGB:
            this_pixel_index = y * (this.width * 3) + (x * 3);


            output.data[output_pixel_index] = this.data[this_pixel_index];
            output.data[output_pixel_index + 1] = this.data[this_pixel_index + 1];
            output.data[output_pixel_index + 2] = this.data[this_pixel_index + 2];
            output.data[output_pixel_index + 3] = 255;
            break;


          case ImageDataExColorSpace.GRAYSCALE_ALPHA:
          case ImageDataExColorSpace.PERCEPTUAL_GRAYSCALE_ALPHA:
            this_pixel_index = y * (this.width * 2) + (x * 2);


            pixel_value = this.data[this_pixel_index];


            output.data[output_pixel_index] = pixel_value;
            output.data[output_pixel_index + 1] = pixel_value;
            output.data[output_pixel_index + 2] = pixel_value;
            output.data[output_pixel_index + 3] = this.data[this_pixel_index + 1];
            break;


          case ImageDataExColorSpace.PERCEPTUAL_GRAYSCALE:
          default:
            this_pixel_index = y * this.width + x;


            pixel_value = this.data[this_pixel_index];


            output.data[output_pixel_index] = pixel_value;
            output.data[output_pixel_index + 1] = pixel_value;
            output.data[output_pixel_index + 2] = pixel_value;
            output.data[output_pixel_index + 3] = 255;
        }

      }
    }


    return output;
  }




  printSelf() {
    console.log(
      '---ImageDataEx Object---' +
      '\nWidth: ' +
      this.width +
      '\nHeight: ' +
      this.height +
      '\nColorspace: ' +
      this.colorspace +
      '\nData: '
    );


    console.log(this.data);
  }
}