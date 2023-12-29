//@ts-nocheck
'use strict';


export const MatrixDataType = {
  INT8: 'int8',
  UINT8: 'uint8',
  INT16: 'int16',
  UINT16: 'uint16',
  INT32: 'int32',
  UINT32: 'uint32',
  INT64: 'int64',
  UINT64: 'uint64',
  FLOAT32: 'float32',
  FLOAT64: 'float64',
};


//Creates a column major matrix.
export class Matrix {
  rows;
  columns;
  datatype;
  data = null;
  initialized = false;

  constructor(rows = null, columns = null, datatype = MatrixDataType.INT32) {
    if (rows !== null && columns !== null && datatype !== null) {

      //If all parameters are valid, then create a new matrix with the
      //specified amount of rows, columns and specified datatype.
      this.rows = rows;
      this.columns = columns;
      this.datatype = datatype;


      switch (datatype) {
        case MatrixDataType.FLOAT32:
          this.data = new Float32Array(rows * columns);
          break;
        case MatrixDataType.FLOAT64:
          this.data = new Float64Array(rows * columns);
          break;
        case MatrixDataType.INT64:
          this.data = new BigInt64Array(rows * columns);
          break;
        case MatrixDataType.UINT64:
          this.data = new BigUint64Array(rows * columns);
          break;
        case MatrixDataType.INT8:
          this.data = new Int8Array(rows * columns);
          break;
        case MatrixDataType.UINT8:
          this.data = new Uint8Array(rows * columns);
          break;
        case MatrixDataType.INT16:
          this.data = new Int16Array(rows * columns);
          break;
        case MatrixDataType.UINT16:
          this.data = new Uint16Array(rows * columns);
          break;
        case MatrixDataType.UINT32:
          this.data = new Uint32Array(rows * columns);
          break;
        case MatrixDataType.INT32:
        default:
          this.data = new Int32Array(rows * columns);
      }


      //Boolean flag to indicate that this Matrix object is initialized.
      //Matrix operations will only be available to matricies that are
      //initialized.
      this.initialized = true;
    }
    else {
      this.initialized = false;
    }
  }


  initializeWith(matrix_array, datatype = MatrixDataType.INT32) {
    this.columns = matrix_array.length;
    this.rows = matrix_array[0].length;
    this.datatype = datatype;


    switch (datatype) {
      case MatrixDataType.FLOAT32:
        this.data = new Float32Array(this.rows * this.columns);
        break;
      case MatrixDataType.FLOAT64:
        this.data = new Float64Array(this.rows * this.columns);
        break;
      case MatrixDataType.INT64:
        this.data = new BigInt64Array(this.rows * this.columns);
        break;
      case MatrixDataType.UINT64:
        this.data = new BigUint64Array(this.rows * this.columns);
        break;
      case MatrixDataType.INT8:
        this.data = new Int8Array(this.rows * this.columns);
        break;
      case MatrixDataType.UINT8:
        this.data = new Uint8Array(this.rows * this.columns);
        break;
      case MatrixDataType.INT16:
        this.data = new Int16Array(this.rows * this.columns);
        break;
      case MatrixDataType.UINT16:
        this.data = new Uint16Array(this.rows * this.columns);
        break;
      case MatrixDataType.UINT32:
        this.data = new Uint32Array(this.rows * this.columns);
        break;
      case MatrixDataType.INT32:
      default:
        this.data = new Int32Array(this.rows * this.columns);
    }


    //Populate the data array with the specified matrix array.
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.columns; j++) {
        this.data[j * this.rows + i] = matrix_array[j][i];
      }
    }


    this.initialized = true;


    //Return a reference to this object for method chaining.
    return this;
  }


  toString() {
    if (this.initialized === true) {
      let string = '';


      for (let j = 0; j < this.columns; j++) {
        string += '\ncolumn ' + (j + 1) + ': ' + this.data.slice(j * this.rows, j * this.rows + this.rows).toString();
      }


      string += '\nrows: ' + this.rows +
        '\ncolumns: ' + this.columns +
        '\ndatatype: ' + this.datatype;


      return string;
    }
    else return 'This matrix is not initialized.';
  }
}