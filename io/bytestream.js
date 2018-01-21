/*
 * bytestream.js
 *
 * Provides readers for byte streams.
 *
 * Licensed under the MIT License
 *
 * Copyright(c) 2011 Google Inc.
 * Copyright(c) 2011 antimatter15
 */

var bitjs = bitjs || {};
bitjs.io = bitjs.io || {};


// TODO: Add method for pushing bits (multiple arrays) and have tests.
// TODO: Add method for tee-ing off the stream with tests.
/**
 * This object allows you to peek and consume bytes as numbers and strings
 * out of an ArrayBuffer.  In this buffer, everything must be byte-aligned.
 */
bitjs.io.ByteStream = class {
  /**
   * @param {ArrayBuffer} ab The ArrayBuffer object.
   * @param {number=} opt_offset The offset into the ArrayBuffer
   * @param {number=} opt_length The length of this BitStream
   */
  constructor(ab, opt_offset, opt_length) {
    if (!(ab instanceof ArrayBuffer)) {
      throw 'Error! BitArray constructed with an invalid ArrayBuffer object';
    }

    const offset = opt_offset || 0;
    const length = opt_length || ab.byteLength;
    this.bytes = new Uint8Array(ab, offset, length);
    this.ptr = 0;
    this.pages_ = [];
  }

  /**
   * Returns how many bytes are currently in the stream left to be read.
   * @private
   */
  getBytesLeft_() {
    const bytesInCurrentPage = (this.bytes.byteLength - this.ptr);
    return this.pages_.reduce((acc, arr) => acc + arr.length, bytesInCurrentPage);
  }

  /**
   * Move the pointer ahead n bytes.  If the pointer is at the end of the current array
   * of bytes and we have another page of bytes, point at the new page.  This is a private
   * method, no validation is done.
   * @param {number} n Number of bytes to increment.
   * @private
   */
  movePointer_(n) {
    this.ptr += n;
    while (this.ptr >= this.bytes.length && this.pages_.length > 0) {
      this.ptr -= this.bytes.length;
      this.bytes = this.pages_.shift();
    }
  }

  /**
   * Peeks at the next n bytes as an unsigned number but does not advance the
   * pointer
   * TODO: This apparently cannot read more than 4 bytes as a number?
   * @param {number} n The number of bytes to peek at.  Must be a positive integer.
   * @return {number} The n bytes interpreted as an unsigned number.
   */
  peekNumber(n) {
    const num = parseInt(n, 10);
    if (n !== num || num < 0) {
      throw 'Error!  Called peekNumber() with a non-positive integer';
    } else if (num === 0) {
      return 0;
    }

    // TODO: Throw an error if n > 4.

    if (this.getBytesLeft_() < num) {
      throw 'Error!  Overflowed the byte stream while peekNumber()! n=' + num +
      ', ptr=' + this.ptr + ', bytes.length=' + this.bytes.length;
    }

    let result = 0;
    let curPage = this.bytes;
    let pageIndex = 0;
    let ptr = this.ptr;
    for (let i = 0; i < num; ++i) {
      result |= (curPage[ptr++] << (i * 8));

      if (ptr >= curPage.length) {
        curPage = this.pages_[pageIndex++];
        ptr = 0;
      }
    }

    return result;
  }


  /**
   * Returns the next n bytes as an unsigned number (or -1 on error)
   * and advances the stream pointer n bytes.
   * @param {number} n The number of bytes to read.  Must be a positive integer.
   * @return {number} The n bytes interpreted as an unsigned number.
   */
  readNumber(n) {
    const num = this.peekNumber(n);
    this.movePointer_(n);
    return num;
  }


  /**
   * Returns the next n bytes as a signed number but does not advance the
   * pointer.
   * @param {number} n The number of bytes to read.  Must be a positive integer.
   * @return {number} The bytes interpreted as a signed number.
   */
  peekSignedNumber(n) {
    let num = this.peekNumber(n);
    const HALF = Math.pow(2, (n * 8) - 1);
    const FULL = HALF * 2;

    if (num >= HALF) num -= FULL;

    return num;
  }


  /**
   * Returns the next n bytes as a signed number and advances the stream pointer.
   * @param {number} n The number of bytes to read.  Must be a positive integer.
   * @return {number} The bytes interpreted as a signed number.
   */
  readSignedNumber(n) {
    const num = this.peekSignedNumber(n);
    this.movePointer_(n);
    return num;
  }


  /**
   * This returns n bytes as a sub-array, advancing the pointer if movePointers
   * is true.
   * @param {number} n The number of bytes to read.  Must be a positive integer.
   * @param {boolean} movePointers Whether to move the pointers.
   * @return {Uint8Array} The subarray.
   */
  peekBytes(n, movePointers) {
    const num = parseInt(n, 10);
    if (n !== num || num <= 0) {
      throw 'Error!  Called peekBytes() with a non-positive integer';
    } else if (num === 0) {
      return new Uint8Array();
    }

    const totalBytesLeft = this.getBytesLeft_();
    if (num > totalBytesLeft) {
      throw 'Error!  Overflowed the byte stream! n=' + num + ', ptr=' + this.ptr +
          ', bytes.length=' + this.bytes.length;
    }

    const result = new Uint8Array(num);
    let curPage = this.bytes;
    let pageIndex = 0;
    let ptr = this.ptr;
    for (let i = 0; i < num; ++i) {
      result[i] = curPage[ptr++];
      if (ptr >= curPage.length) {
        curPage = this.pages_[pageIndex++];
        ptr = 0;
      }
    }

    if (movePointers) {
      this.movePointer_(num);
    }

    return result;
  }

  /**
   * Reads the next n bytes as a sub-array.
   * @param {number} n The number of bytes to read.  Must be a positive integer.
   * @return {Uint8Array} The subarray.
   */
  readBytes(n) {
    return this.peekBytes(n, true);
  }

  /**
   * Peeks at the next n bytes as an ASCII string but does not advance the pointer.
   * @param {number} n The number of bytes to peek at.  Must be a positive integer.
   * @return {string} The next n bytes as a string.
   */
  peekString(n) {
    const num = parseInt(n, 10);
    if (n !== num || num < 0) {
      throw 'Error!  Called peekString() with a non-positive integer';
    } else if (num === 0) {
      return '';
    }

    const totalBytesLeft = this.getBytesLeft_();
    if (num > totalBytesLeft) {
      throw 'Error!  Overflowed the byte stream while peekString()! n=' + num +
      ', ptr=' + this.ptr + ', bytes.length=' + this.bytes.length;
    }

    let result = new Array(num);
    let curPage = this.bytes;
    let pageIndex = 0;
    let ptr = this.ptr;
    for (let i = 0; i < num; ++i) {
      result[i] = String.fromCharCode(curPage[ptr++]);
      if (ptr >= curPage.length) {
        curPage = this.pages_[pageIndex++];
        ptr = 0;
      }
    }

    return result.join('');
  }

  /**
   * Returns the next n bytes as an ASCII string and advances the stream pointer
   * n bytes.
   * @param {number} n The number of bytes to read.  Must be a positive integer.
   * @return {string} The next n bytes as a string.
   */
  readString(n) {
    const strToReturn = this.peekString(n);
    this.movePointer_(n);
    return strToReturn;
  }

  /**
   * Feeds more bytes into the back of the stream.
   * @param {ArrayBuffer} ab 
   */
  push(ab) {
    if (!(ab instanceof ArrayBuffer)) {
      throw 'Error! push() called with an invalid ArrayBuffer object';
    }

    this.pages_.push(new Uint8Array(ab));
    // If the pointer is at the end of the current page of bytes, this will advance
    // to the next page.
    this.movePointer_(0);
  }
}
