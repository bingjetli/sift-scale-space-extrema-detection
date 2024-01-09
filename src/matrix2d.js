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




/** VECTORS
 * 
 * This file also contains definitions for how Vectors are represented.
 * 
 * Vectors are represented like their mathematical counterparts such 
 * that a vector is a 1-D array of values which represent a column of
 * data.
 * 
 * 
 * This structure has the following schema :
 * 
 * [n, n, ..., n]
 * 
 * 
 * A `matrix2d` object can then be considered to be an array of `vectors`.
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




export function Matrix2D_get2x2Determinant(matrix) {

  /** CALCULATING THE DETERMINANT OF A 2x2 MATRIX
   * 
   * Given a 2x2 matrix with the scheme :
   * 
   * +-   -+
   * | a b |
   * | c d |
   * +-   -+
   * 
   * The determinant of this matrix is given by :
   * ad - bc
   */
  return (matrix[0][0] * matrix[1][1]) - (matrix[0][1] * matrix[1][0]);
}




/**
 * 
 * @param {Matrix2D} matrix The source 3x3 Matrix.
 * @param {bool} return_minors A boolean value that determines whether
 * or not to return the matrix of minors when calculating the Determinant.
 * @returns The calculated determinant value of the 3x3 matrix. Or
 * an object containing both the determinant and the matrix of minors
 * used in the calculation of the determinant. The object has the 
 * following schema :
 * 
 * {
 *  determinant : Number,
 *  minors : [m, m, m],
 * }
 * 
 * where `m` represents the calculated `minors` of the values found in
 * the first row of the 3x3 matrix.
 * 
 */
export function Matrix2D_get3x3Determinant(matrix, return_minors = false) {

  /** CALCULATING THE DETERMINANT OF A 3x3 MATRIX
   * 
   * Given a 3x3 matrix with the scheme :
   * 
   * +-     -+
   * | a b c |
   * | d e f |
   * | g h i |
   * +-     -+
   * 
   * The determinant of this matrix is given by :
   *  a * minor(a) - b * minor(b) + c * minor(c)
   * 
   * where the `minor(§)` is given by the determinant of the resulting
   * matrix when the column and row containing `§` is removed.
   * 
   * 
   * The final formula is given by : a(ei - fh) - b(di - fg) + c(dh - eg)
   * 
   */
  const minors = [
    Matrix2D_get2x2Determinant(Matrix2D_getMinorMatrix(matrix, 0, 0)),
    Matrix2D_get2x2Determinant(Matrix2D_getMinorMatrix(matrix, 0, 1)),
    Matrix2D_get2x2Determinant(Matrix2D_getMinorMatrix(matrix, 0, 2)),
  ];


  const determinant = (
    (matrix[0][0] * minors[0]) -
    (matrix[0][1] * minors[1]) +
    (matrix[0][2] * minors[2])
  );


  if (return_minors === true) return {
    determinant: determinant,
    minors: minors,
  };
  else return determinant;
}




/**
 * 
 * @param {Matrix2D} matrix The input matrix to calculate the matrix of
 * minors for.
 * @param {boolean} fill_existing A boolean value that determines whether
 * or not to use an existing matrix for the calculations.
 * @param {Matrix2D} existing_minor_matrix The existing matrix of minors
 * that contains `null` slots indicating the slot that needs to be filled.
 * 
 * The existing matrix of minors should have the following schema :
 * [
 *  [m, m, m],
 *  [m, m, m],
 *  [m, m, m],
 * ]
 * where `m` indicates either an existing value or `null`.
 * 
 * @returns A `Matrix2D` of determinants calculated from the resulting
 * 2x2 Matrix obtained by removing the `i`th row and `j`th column.
 * 
 */
export function Matrix2D_get3x3Minors(
  matrix,
  fill_existing = false,
  existing_minor_matrix = null
) {
  const [_rows, _columns] = Matrix2D_getDimensions(matrix);


  if (fill_existing === true) {

    //Iterate through the existing matrix, and calculate the missing
    //minor values.
    for (let _i = 0; _i < _rows; _i++) {
      for (let _j = 0; _j < _columns; _j++) {

        //If there is no value present at the specified location for the
        //existing minor matrix, then generate the minor value by 
        //calculating the determinant of the resulting 2x2 matrix obtained
        //from removing the `_i`th row and `_j`th column.
        if (existing_minor_matrix[_i][_j] === null) {
          existing_minor_matrix[_i][_j] = Matrix2D_get2x2Determinant(Matrix2D_getMinorMatrix(matrix, _i, _j));
        }

      }
    }


    //Finally, return a reference to the existing matrix of minors.
    return existing_minor_matrix;
  }
  else return Matrix2D_build(_rows, _columns, (i, j) => {
    return Matrix2D_get2x2Determinant(Matrix2D_getMinorMatrix(matrix, i, j));
  });
}




/**
 * 
 * @param {Matrix2D} matrix The source matrix.
 * @param {uint} i The row of the element to calculate the minor for.
 * @param {uint} j The column of the element to calculate the minor for.
 * @returns A deep copy `Matrix2D` of the source matrix containing the
 * `i`th row and `j`th column removed.
 */
export function Matrix2D_getMinorMatrix(matrix, i, j) {
  const [_rows, _columns] = Matrix2D_getDimensions(matrix);


  const output = [];


  for (let _i = 0; _i < _rows; _i++) {

    //Skip the row that the element we are calculating the minor for 
    //is on.
    if (_i === i) continue;


    const row = [];
    for (let _j = 0; _j < _columns; _j++) {

      //Skip the column that the element we are calculating the minor
      //for is on.
      if (_j === j) continue;


      //Deep copy the value by converting it to a string, then back to
      //a number.
      row.push(Number(matrix[_i][_j].toString()));
    }


    output.push(row);
  }


  return output;
}



/**
 * 
 * @param {Matrix2D} matrix_of_minors The `Matrix2D` containing the 
 * calculated determinants of the resulting 2x2 matrices obtained by
 * removing the `i`th row and `j`th column of the original matrix.
 * @returns The `Matrix2D` containing the values of the matrix of minors
 * multiplied by the coefficient given by `(-1)^(i + j)` where `i` and
 * `j` represent the row and column respectively.
 */
export function Matrix2D_get3x3Cofactors(matrix_of_minors) {
  const [_rows, _columns] = Matrix2D_getDimensions(matrix_of_minors);


  /** CALCULATING THE MATRIX OF COFACTORS
   * 
   * The matrix of cofactors can be calculate by taking a matrix of 
   * minors, and multiplying each element by `(-1)^(i + j)` where `i`
   * and `j` refers to the row and column of the element respectively.
   * 
   */
  return Matrix2D_build(_rows, _columns, (i, j) => matrix_of_minors[i][j] * Math.pow(-1, i + j));
}




export function Matrix2D_transpose(matrix) {
  /** TRANSPOSING MATRICES
   * 
   * Transposing a matrix means to switch its columns with its
   * rows. So given a 3x3 matrix of the following schema :
   * 
   * +-        -+
   * | 11 12 13 |
   * | 21 22 23 |
   * | 31 32 33 |
   * +-        -+
   * 
   * The transpose of this matrix will be :
   * 
   * +-        -+
   * | 11 21 31 |
   * | 12 22 32 |
   * | 13 23 33 |
   * +-        -+
   * 
   */
  const [_rows, _columns] = Matrix2D_getDimensions(matrix);


  //Return a matrix with the columns and rows switched. Values are deep
  //copied by converting into a string then back to a number. 
  return Matrix2D_build(_columns, _rows, (j, i) => Number(matrix[i][j].toString()));
}




export function Matrix2D_scalarDivide(matrix, scalar) {
  const [_rows, _columns] = Matrix2D_getDimensions(matrix);


  return Matrix2D_build(_rows, _columns, (i, j) => matrix[i][j] / scalar);
}




export function Matrix2D_scalarMultiply(matrix, scalar) {
  const [_rows, _columns] = Matrix2D_getDimensions(matrix);


  return Matrix2D_build(_rows, _columns, (i, j) => matrix[i][j] * scalar);
}




export function Matrix2D_get3x3Inverse(matrix) {

  //Calculate the determinant of this 3x3 matrix and cache the top row
  //minors used to calculate the determinant.
  const {
    determinant,
    minors: top_row_minors,
  } = Matrix2D_get3x3Determinant(matrix, true);


  //EPSILON is the smallest increment between 1.0 and the next
  //number following 1.0. Therefore determinant values smaller
  //than this EPSILON value is treated as effectively zero since
  //floating point math becomes inaccurate after a certain level
  //of precision. Since the determinant is effectively zero,
  //we treat it as such, and an inverse cannot be calculated
  //for matrices with a determinant of 0.
  //if (hessian_determinant < Number.EPSILON) break;
  if (Math.abs(determinant) < Number.EPSILON) return null;


  //If the determinant is valid, then we calculate the minor
  //matrix for the Hessian in order to calculate the cofactors.
  const matrix_minors = Matrix2D_get3x3Minors(
    matrix, true,
    [
      top_row_minors,
      [null, null, null],
      [null, null, null],
    ]
  );


  //Now calculate the cofactor matrix for the Hessian.
  const matrix_cofactors = Matrix2D_get3x3Cofactors(matrix_minors);


  //Transposing the cofactor matrix will now give the adjunct
  //matrix which can be scalar divided by the determinant to
  //produce the inverse of the Hessian matrix.
  const adjunct_matrix = Matrix2D_transpose(matrix_cofactors);


  //Finally, scalar divide the Adjunct matrix by the determinant.
  return Matrix2D_scalarDivide(adjunct_matrix, determinant);
}




export function Matrix2D_vectorMultiply(matrix, vector) {
  const [_rows, _columns] = Matrix2D_getDimensions(matrix);
  const vector_rows = vector.length;


  //Vector to Matrix multiplication is only possible when the columns
  //of the Matrix is equal to the rows of the vector. This is because
  //Vectors are columns of values, and they are first transposed before
  //being multiplied into the matrix.
  if (vector_rows !== _columns) return null;


  const output_vector = [];
  for (let i = 0; i < _rows; i++) {

    let result = 0;
    for (let j = 0; j < _columns; j++) {

      result += matrix[i][j] * vector[j];
    }


    output_vector.push(result);
  }


  return output_vector;
}