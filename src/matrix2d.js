//@ts-nocheck
'use strict';


/** WHAT IS A MATRIX?
 * 
 * This structure is a 2-dimensional array based on the concept of 
 * Matrices from Linear Algebra.
 * 
 * 
 * They follow a column-major scheme to remain consistent with 
 * mathematical notation. Therefore accessing a value (i, j) inside
 * a matrix means to access the value in `row i` and `column j`.
 * 
 * 
 * This structure has the following schema : 
 *    
 *  +-------------------> (j)
 *  |
 *  |  [
 *  |   [n, n, ..., n],
 *  |   [n, n, ..., n],
 *  |          ...
 *  |   [n, n, ..., n],
 *  |  ]
 *  v  
 * (i)
 *    
 * where `n` is the number inside the matrix.
 * 
 */




/**
 * 
 * @param {Matrix2D} matrix 
 * @returns An array containing the dimensions of the matrix with the 
 * scheme: [rows, columns].
 */
export function Matrix2D_getDimensions(matrix) {
  return [matrix.length, matrix[0].length];
}




/**
 * 
 * @param {uint} rows 
 * @param {uint} columns 
 * @param {function} __setValue Callback function that determines the
 * value of each row and column. Has the scheme (i, j) => value.
 * @returns A Matrix2D with the specified rows and columns containing
 * values populated by the specified callback function.
 */
export function Matrix2D_build(rows, columns, __setValue) {
  const output = [];


  for (let i = 0; i < rows; i++) {
    const row = [];


    for (let j = 0; j < columns; j++) {
      row.push(__setValue(i, j));
    }


    output.push(row);
  }


  return output;
}





/**
 * 
 * @param {Matrix2D} matrix The input matrix.
 * @param {Float} sampling_rate Defines how far to move along the matrix
 * before sampling the value. For example, `1` will sample each pixel 
 * once. `2` will sample every other pixel. `0.5` will sample each pixel
 * twice.
 * @returns A `Matrix2D` resampled by the specified sampling rate.
 */
export function Matrix2D_linearResize(matrix, sampling_rate) {
  const [_rows, _columns] = Matrix2D_getDimensions(matrix);


  const output = [];


  for (let i = 0; i < _rows; i += sampling_rate) {

    const row = [];


    for (let j = 0; j < _columns; j += sampling_rate) {

      //Deep copy the value by converting it to a string, then back to
      //a number. Decimal values are truncated since we want to keep
      //consistent behavior when upsampling with decimal sampling rates.
      row.push(Number(matrix[Math.floor(i)][Math.floor(j)].toString()));
    }


    output.push(row);
  }


  return output;
}




/**
 * 
 * @param {Matrix2D} matrix 
 * @param {int} coefficient a value between `4` or `5` seems to work well for normalizing
 * [-1, 1] to [0, 1].
 * @returns A `Matrix2D` with the values of the input matrix normalized
 * using a sigmoid function, optionally scaled by a coefficient.
 */
export function Matrix2D_sigmoidNormalize(matrix, coefficient = 1) {
  const [rows, columns] = Matrix2D_getDimensions(matrix);


  return Matrix2D_build(rows, columns, (i, j) => {
    return 1 / (1 + Math.exp(coefficient * (-1 * matrix[i][j])));
  });
}




/**
 * 
 * @param {Matrix2D} matrix 
 * @returns A `Matrix2D` of the input matrix normalized using the minimum
 * and maximum values sampled from the input matrix.
 */
export function Matrix2D_sampledNormalize(matrix) {

  //First, sample the input matrix to get the minimum and maximum
  //values.
  const [rows, columns] = Matrix2D_getDimensions(matrix);
  let min = Number.MAX_SAFE_INTEGER;
  let max = Number.MIN_SAFE_INTEGER;
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < columns; j++) {
      const value = matrix[i][j];


      if (value < min) min = value;


      if (value > max) max = value;
    }
  }


  //Normalize the values inside the input matrix with the minimum and
  //maximum values obtained above.
  return Matrix2D_build(rows, columns, (i, j) => (matrix[i][j] - min) / (max - min));
}