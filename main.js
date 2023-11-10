//@ts-nocheck
'use strict';

window.onload = () => main();

function main(){
  const le_bouton_pour_charger = document.getElementById('load-button');
  le_bouton_pour_charger.onclick = async e => {
    //Destructure the 1-element array returned by `.showOpenFilePicker()`.
    const [le_fichier] = await window.showOpenFilePicker({
      types: [{
        description: 'Images',
        accept: {'image/*': ['.png', '.gif', '.jpeg', '.jpg']},
      }],
      excludeAcceptAllOption: true,
      multiple: false,
    });

    //Now that we have the image, load the image by first creating
    //an object URL for it. Pass that to a `<img>` element as it's
    //image source.
    const la_url_de_l_image = URL.createObjectURL(
      await le_fichier.getFile()
    );
    const le_element_de_l_image = new Image();
    le_element_de_l_image.src = la_url_de_l_image;

    //When the image loads, draw the image on the canvas and clean
    //up the resources used by `.createObjectURL()`.
    le_element_de_l_image.onload = e => {
      const la_toile = document.getElementById('canvas');
      const le_contexte = la_toile.getContext('2d');

      //Resize the canvas dimensions to the image dimensions.
      la_toile.width = le_element_de_l_image.width;
      la_toile.height = le_element_de_l_image.height;

      le_contexte.drawImage(le_element_de_l_image, 0, 0);
        
      //Cleanup the memory used by `.createObjectURL()`.
      URL.revokeObjectURL(la_url_de_l_image);

      processImage(
        le_contexte, 
        le_element_de_l_image.width,
        le_element_de_l_image.height
      );
    };
  }
}


function processImage(canvas_context, image_width, image_height){
  const les_donnees_d_image = canvas_context.getImageData(
    0, 0, image_width, image_height
  );

  const s = 20;
  const la_image_filtre = applyGaussianFilter(les_donnees_d_image, 2 * Math.PI * s, s);

  canvas_context.putImageData(la_image_filtre, 0, 0);
}


//Returns a copy the pixel located at `x`, `y` of the specified `image_data`. 
//This pixel is 4 indices containing values of 0-255 with each index 
//corresponding to the RGBA value of the pixel. The pixel that is returned
//cannot interact with the pixel data in the image data. This function
//returns `null` if the `x` and `y` coordinates are out of bounds.
function getPixelFromImageData(image_data, x, y){
  //If the x, y coordinates are out of bounds, return null since
  //there is no pixel data there.
  if(
    x < 0 || 
    x >= image_data.width ||
    y < 0 ||
    y >= image_data.height
  ){
    return null;
  }

  //The index where the pixel data starts. Calculated by determining
  //the offset for where the row starts, then adding the offset of
  //where the column starts.
  const le_index_initial = y * (image_data.width * 4) + (x * 4);
  return image_data.data.slice(
    le_index_initial, //Starting index is inclusive.
    le_index_initial + 4 //Ending index is exclusive.
  );
}

//This function mutates the pixel rgba array at `x` and `y` for the
//specified `image_data`. The `pixel` parameter takes an array of length
//4 with each index corresponding to the pixel's RGBA value from 0-255.
//This function does nothing if the `x` and `y` values are out of bounds.
function setPixelForImageData(image_data, x, y, pixel){
  //If the x, y coordinates are out of bounds, do nothing since
  //there is no pixel data there.
  if(
    x < 0 || 
    x >= image_data.width ||
    y < 0 ||
    y >= image_data.height
  ){
    return;
  }

  //The index where the pixel data starts. Calculated by determining
  //the offset for where the row starts, then adding the offset of
  //where the column starts.
  const le_index_initial = y * (image_data.width * 4) + (x * 4);
  image_data.data[le_index_initial] = pixel[0];
  image_data.data[le_index_initial+1] = pixel[1];
  image_data.data[le_index_initial+2] = pixel[2];
  image_data.data[le_index_initial+3] = pixel[3];
}


function applyGaussianFilter(
  input_image_data, 
  kernel_size,
  sigma
){
  //Build the Gaussian kernel. Based on this lecture from `First Principles
  //of Computer Vision`, [https://youtu.be/-LD9MxBUFQo?si=QZVE3I0Cbp1teSs-]
  //the kernel_size and sigma values are related based on this rule of 
  //thumb : `kernel_size ~= 2 * PI * sigma`. This lets us capture most 
  //of the important information about the Gaussian function.

  //We also want to center the Gaussian function so we offset it by using
  // x - floor(kernel_size / 2).
  const la_quantite_de_deplacement = Math.floor(kernel_size / 2);
  let la_fenetre = [];
  let la_somme = 0;
  for(let k = 0; k < kernel_size; k++){
    //Calculate the displaced x value so we have the Gaussian peak in
    //the center of the kernel.
    const x = k - la_quantite_de_deplacement;

    //Sample the Gaussian g(x) function with the displaced x value and
    //the sigma value. The Gaussian function can be obtained from:
    //[https://staff.fnwi.uva.nl/r.vandenboomgaard/IPCV20172018/LectureNotes/IP/LocalStructure/GaussianDerivatives.html]
    const g_x = (1 / (Math.sqrt(2 * Math.PI) * sigma)) * Math.exp(-1 * ((x * x) / (2 * (sigma * sigma))));

    //Add the sampled Gaussian to the kernel (window).
    la_fenetre.push(g_x);

    //Keep track of the total, we're going to use this to normalize the
    //kernel later.
    la_somme += g_x;
  }

  //Normalize the generated gaussian kernel, so all the values inside
  //will add up to 1.
  la_fenetre = la_fenetre.map(e => e / la_somme);

  //First pass, convolve image along the rows using the 1-D Gaussian
  //kernel. This takes advantages of the fact that the Gaussian filter
  //can be separated into 2 operations.
  const i1 = new ImageData(
    input_image_data.data, 
    input_image_data.width, 
    input_image_data.height
  )
  for(let y = 0; y < input_image_data.height; y++){
    for(let x = 0; x < input_image_data.width; x++){
      const le_resultat = [0, 0, 0, 0];
      for(let k = 0; k < kernel_size; k++){
        const le_displacement = k - Math.floor(kernel_size / 2);
        const le_pixel = getPixelFromImageData(input_image_data, x + le_displacement, y);

        if(le_pixel !== null){
          le_resultat[0] += le_pixel[0] * la_fenetre[k];
          le_resultat[1] += le_pixel[1] * la_fenetre[k];
          le_resultat[2] += le_pixel[2] * la_fenetre[k];
          le_resultat[3] += le_pixel[3] * la_fenetre[k];
        }
      }

      setPixelForImageData(i1, x, y, le_resultat);
    }
  }
  

  //Second pass, convolve the image along the columns using the generated
  //1-D Gaussian kernel.
  const i2 = new ImageData(
    i1.data, 
    i1.width, 
    i1.height
  )
  for(let x = 0; x < input_image_data.width; x++){
    for(let y = 0; y < input_image_data.height; y++){
      const le_resultat = [0, 0, 0, 0];
      for(let k = 0; k < kernel_size; k++){
        const le_displacement = k - Math.floor(kernel_size / 2);
        const le_pixel = getPixelFromImageData(i1, x, y + le_displacement);

        if(le_pixel !== null){
          le_resultat[0] += le_pixel[0] * la_fenetre[k];
          le_resultat[1] += le_pixel[1] * la_fenetre[k];
          le_resultat[2] += le_pixel[2] * la_fenetre[k];
          le_resultat[3] += le_pixel[3] * la_fenetre[k];
        }
      }

      setPixelForImageData(i2, x, y, le_resultat);
    }
  }

  return i2;
}