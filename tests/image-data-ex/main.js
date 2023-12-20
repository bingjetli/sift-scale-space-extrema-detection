//@ts-nocheck
import { ImageDataEx, ImageDataExColorSpace } from '../../src/image-data-ex.js';


window.onload = _ => {
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

      //Cache a handle to the main canvas and set the canvas dimensions.
      const input_canvas = document.getElementById('input');
      input_canvas.width = image_element.width;
      input_canvas.height = image_element.height;


      //Cache a handle to the main canvas's context as well.
      const input_canvas_context = input_canvas.getContext('2d');


      //When the image loads, draw the image on the main canvas
      //and clean up the resources used by `.createObjectURL()`.
      input_canvas_context.drawImage(image_element, 0, 0);
      URL.revokeObjectURL(image_url);


      //Convert the image to a grayscale Image2D array and draw it onto
      //the appropriate canvas.
      const grayscale = new ImageDataEx().loadDataFrom(
        input_canvas_context.getImageData(
          0, 0, image_element.width, image_element.height
        ),
        ImageDataExColorSpace.GRAYSCALE
      );
      const grayscale_canvas = document.getElementById('grayscale');
      grayscale_canvas.width = grayscale.width;
      grayscale_canvas.height = grayscale.height;
      grayscale_canvas.getContext('2d').putImageData(grayscale.toImageData(), 0, 0);


      //Convert the image to a perceptual grayscale Image2D array and 
      //draw it onto the appropriate canvas.
      let image_data_ex = new ImageDataEx().loadDataFrom(
        input_canvas_context.getImageData(
          0, 0, image_element.width, image_element.height
        ),
        ImageDataExColorSpace.PERCEPTUAL_GRAYSCALE
      );
      let canvas = document.getElementById('perceptual-grayscale');
      canvas.width = image_data_ex.width;
      canvas.height = image_data_ex.height;
      canvas.getContext('2d').putImageData(image_data_ex.toImageData(), 0, 0);


      //Convert the image to a perceptual grayscale alpha Image2D array and 
      //draw it onto the appropriate canvas.
      image_data_ex = new ImageDataEx().loadDataFrom(
        input_canvas_context.getImageData(
          0, 0, image_element.width, image_element.height
        ),
        ImageDataExColorSpace.PERCEPTUAL_GRAYSCALE_ALPHA
      );
      canvas = document.getElementById('perceptual-grayscale-alpha');
      canvas.width = image_data_ex.width;
      canvas.height = image_data_ex.height;
      canvas.getContext('2d').putImageData(image_data_ex.toImageData(), 0, 0);
    };
  };
};