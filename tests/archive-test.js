/*
 * archive-test.js
 *
 * Licensed under the MIT License
 *
 * Copyright(c) 2017 Google Inc.
 */

const assertEquals = muther.assertEquals;
const testInputs = {
    'testUnzipDeflate': 'archive-testfiles/test-unzip-deflate.json',
    'testUnzipStore': 'archive-testfiles/test-unzip-store.json',
    'testUnrarM1': 'archive-testfiles/test-unrar-m1.json',
    'testUnrarM2': 'archive-testfiles/test-unrar-m2.json',
    'testUnrarM3': 'archive-testfiles/test-unrar-m3.json',
    'testUnrarM4': 'archive-testfiles/test-unrar-m4.json',
    'testUnrarM5': 'archive-testfiles/test-unrar-m5.json',
    'testUnrarMA4': 'archive-testfiles/test-unrar-ma4.json',
    // On a Mac, tar files contain hidden files.  To disable this do:
    // $ COPYFILE_DISABLE=1 tar cvf lorem.tar lorem.txt
    'testUntar': 'archive-testfiles/test-untar-1.json',
};

const testSuite = {tests: {}};
for (let testName in testInputs) {
  const testInputFilename = testInputs[testName];
  testSuite.tests[testName] = function() {
    return new Promise((resolve, reject) => {
      const scriptEl = document.createElement('script');
      scriptEl.setAttribute('src', testInputFilename);
      scriptEl.addEventListener('load', evt => {
        const testFile = window.archiveTestFile;
        try {
          const archivedFile = new Uint8Array(
              atob(testFile.archivedFile).split(',').map(str => parseInt(str)));
          const unarchivedFile = new Uint8Array(
              atob(testFile.unarchivedFile).split(',').map(str => parseInt(str)));
          const unarchiver = bitjs.archive.GetUnarchiver(archivedFile.buffer, '../');
          unarchiver.addEventListener(bitjs.archive.UnarchiveEvent.Type.EXTRACT, evt => {
              const theUnarchivedFile = evt.unarchivedFile.fileData;
              try {
                assertEquals(theUnarchivedFile.length, unarchivedFile.length,
                    'The unarchived buffer was not the right length');
                for (let i = 0; i < theUnarchivedFile.length; ++i) {
                  assertEquals(theUnarchivedFile[i], unarchivedFile[i],
                      'Byte #' + i + ' did not match');
                }
                resolve();
              } catch (err) {
                reject(err);
              }
          });
          unarchiver.start();
        } catch (err) {
          reject(err);
        }
      });
      document.body.appendChild(scriptEl);
    });
  }
}

muther.go(testSuite);
