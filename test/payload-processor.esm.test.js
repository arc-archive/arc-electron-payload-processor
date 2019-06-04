import { assert } from '@open-wc/testing';
import {PayloadProcessor} from '../payload-processor-esm.js';

describe('arc-electron-payload-processor', () => {
  describe('payloadToString()', () => {
    it('Resolves to the same object when no payload', async () => {
      const obj = {};
      const result = await PayloadProcessor.payloadToString(obj);
      assert.deepEqual(result, obj);
    });

    it('Creates "blob" property from Blob instance', async () => {
      const b = new Blob(['***'], {type: 'text/plain'});
      const obj = {
        payload: b
      };
      const result = await PayloadProcessor.payloadToString(obj);
      assert.equal(result.blob, 'data:text/plain;base64,Kioq');
    });

    it('Removes "payload" with Blob instance', async () => {
      const b = new Blob(['***'], {type: 'text/plain'});
      const obj = {
        payload: b
      };
      const result = await PayloadProcessor.payloadToString(obj);
      assert.isUndefined(result.payload);
    });

    it('Creates "multipart" property from FormData instance', async () => {
      const b = new Blob(['***'], {type: 'text/plain'});
      const fd = new FormData();
      fd.append('file', b, 'file-name');
      fd.append('text', 'abcd');
      fd.append('text-part', b, 'text-part');
      const obj = {
        payload: fd
      };
      const result = await PayloadProcessor.payloadToString(obj);
      assert.typeOf(result.multipart, 'array');
      assert.lengthOf(result.multipart, 3);
    });

    it('Removes "payload" with FormData instance', async () => {
      const b = new Blob(['***'], {type: 'text/plain'});
      const fd = new FormData();
      fd.append('file', b, 'file-name');
      const obj = {
        payload: fd
      };
      const result = await PayloadProcessor.payloadToString(obj);
      assert.isUndefined(result.payload);
    });

    it('Resolves to the same object when payload is string', async () => {
      const obj = {
        payload: 'test'
      };
      const result = await PayloadProcessor.payloadToString(obj);
      assert.deepEqual(result, obj);
    });
  });

  describe('_blobToString()', function() {
    const b = new Blob(['***'], {type: 'text/plain'});
    it('Returns a promise', function() {
      const result = PayloadProcessor._blobToString(b);
      assert.typeOf(result.then, 'function');
      return result;
    });

    it('Promise results to a string', function() {
      return PayloadProcessor._blobToString(b)
      .then((result) => assert.typeOf(result, 'string'));
    });

    it('String is a valid data url', function() {
      return PayloadProcessor._blobToString(b)
      .then((result) => assert.equal(result, 'data:text/plain;base64,Kioq'));
    });
  });

  describe('_dataURLtoBlob()', function() {
    const data = 'data:text/plain;base64,Kioq';

    it('Converts dataurl to blob', () => {
      const result = PayloadProcessor._dataURLtoBlob(data);
      assert.typeOf(result, 'blob');
    });

    it('Restores the type', () => {
      const result = PayloadProcessor._dataURLtoBlob(data);
      assert.equal(result.type, 'text/plain');
    });

    it('Size match', () => {
      const result = PayloadProcessor._dataURLtoBlob(data);
      assert.equal(result.size, 3);
    });
  });

  describe('_createMultipartEntry()', function() {
    let fd;
    beforeEach(function() {
      const b = new Blob(['***'], {type: 'text/plain'});
      fd = new FormData();
      fd.append('file', b, 'file-name');
      fd.append('text', 'abcd');
      fd.append('text-part', b, 'text-part');
      fd._arcMeta = {
        textParts: ['text-part']
      };
    });

    it('Returns a promise', function() {
      const result = PayloadProcessor._createMultipartEntry(fd);
      assert.typeOf(result.then, 'function');
      return result;
    });

    it('Promise results to an array', function() {
      return PayloadProcessor._createMultipartEntry(fd)
      .then((result) => assert.typeOf(result, 'array'));
    });

    it('Computes file part', () => {
      return PayloadProcessor._createMultipartEntry(fd)
      .then((data) => {
        const part = data[0];
        assert.isTrue(part.isFile);
        assert.equal(part.name, 'file');
        assert.equal(part.value, 'data:text/plain;base64,Kioq');
      });
    });

    it('Computes text part', () => {
      return PayloadProcessor._createMultipartEntry(fd)
      .then((data) => {
        const part = data[1];
        assert.isFalse(part.isFile);
        assert.equal(part.name, 'text');
        assert.equal(part.value, 'abcd');
      });
    });

    it('Sets isTextBlob', () => {
      return PayloadProcessor._createMultipartEntry(fd)
      .then((data) => {
        const part = data[2];
        assert.isFalse(part.isFile);
        assert.isTrue(part.isTextBlob);
        assert.equal(part.name, 'text-part');
        assert.equal(part.value, 'data:text/plain;base64,Kioq');
      });
    });
  });

  describe('restoreMultipart()', function() {
    it('Returns empty FormData when no model', () => {
      const result = PayloadProcessor.restoreMultipart();
      assert.typeOf(result, 'formdata');
    });

    it('Processes text entry', () => {
      const fd = PayloadProcessor.restoreMultipart([{
        isFile: false,
        name: 'test-name',
        value: 'test-value'
      }]);
      const result = fd.get('test-name');
      assert.equal(result, 'test-value');
    });

    it('Processes text entry with content type', () => {
      const fd = PayloadProcessor.restoreMultipart([{
        isFile: false,
        isTextBlob: true,
        name: 'test-name',
        value: 'data:text/plain;base64,Kioq'
      }]);
      const result = fd.get('test-name');
      assert.equal(result.type, 'text/plain');
    });

    it('Sets text parts meta data', () => {
      const fd = PayloadProcessor.restoreMultipart([{
        isFile: false,
        isTextBlob: true,
        name: 'test-name',
        value: 'data:text/plain;base64,Kioq'
      }]);
      assert.typeOf(fd._arcMeta, 'object');
      assert.typeOf(fd._arcMeta.textParts, 'array');
      assert.equal(fd._arcMeta.textParts[0], 'test-name');
    });
  });

  describe('restoreMultipart()', () => {
    it('Do nothing when no created payload data', () => {
      const result = PayloadProcessor.restorePayload({});
      assert.deepEqual(result, {});
    });

    it('Restores blob data', () => {
      const data = 'data:text/plain;base64,Kioq';
      const result = PayloadProcessor.restorePayload({
        blob: data
      });
      assert.typeOf(result.payload, 'blob');
      assert.equal(result.payload.type, 'text/plain');
      assert.equal(result.payload.size, 3);
      assert.isUndefined(result.blob);
    });

    it('Restores multipart data', () => {
      const result = PayloadProcessor.restorePayload({
        multipart: [{
          isFile: false,
          name: 'test-name',
          value: 'test-value'
        }]
      });
      assert.ok(result.payload);
      const data = result.payload.get('test-name');
      assert.equal(data, 'test-value');
      assert.isUndefined(result.multipart);
    });
  });
});
