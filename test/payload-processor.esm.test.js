import { assert } from '@open-wc/testing';
import { PayloadProcessor } from '../payload-processor-esm.js';

describe('PayloadProcessor', () => {
  const initRequest = {
    url: 'https://domain.com',
    method: 'POST',
    headers: '',
    type: 'saved',
  };

  describe('payloadToString()', () => {
    it('returns the same object when no payload', async () => {
      const obj = { ...initRequest };
      const result = await PayloadProcessor.payloadToString(obj);
      assert.deepEqual(result, obj);
    });

    it('Creates "blob" property from Blob instance', async () => {
      const b = new Blob(['***'], {type: 'text/plain'});
      const obj = {
        ...initRequest,
        payload: b,
      };
      const result = await PayloadProcessor.payloadToString(obj);
      assert.equal(result.blob, 'data:text/plain;base64,Kioq');
    });

    it('Removes "payload" with Blob instance', async () => {
      const b = new Blob(['***'], {type: 'text/plain'});
      const obj = {
        ...initRequest,
        payload: b,
      };
      const result = await PayloadProcessor.payloadToString(obj);
      assert.isUndefined(result.payload);
    });

    it('creates "multipart" property from FormData instance', async () => {
      const b = new Blob(['***'], {type: 'text/plain'});
      const fd = new FormData();
      fd.append('file', b, 'file-name');
      fd.append('text', 'abcd');
      fd.append('text-part', b, 'text-part');
      const obj = {
        ...initRequest,
        payload: fd,
      };
      const result = await PayloadProcessor.payloadToString(obj);
      assert.typeOf(result.multipart, 'array');
      assert.lengthOf(result.multipart, 3);
    });

    it('removes "payload" with FormData instance', async () => {
      const b = new Blob(['***'], {type: 'text/plain'});
      const fd = new FormData();
      fd.append('file', b, 'file-name');
      const obj = {
        ...initRequest,
        payload: fd,
      };
      const result = await PayloadProcessor.payloadToString(obj);
      assert.isUndefined(result.payload);
    });

    it('resolves to the same object when payload is string', async () => {
      const obj = {
        ...initRequest,
        payload: 'test',
      };
      const result = await PayloadProcessor.payloadToString(obj);
      assert.deepEqual(result, obj);
    });
  });

  describe('blobToString()', () => {
    const b = new Blob(['***'], {type: 'text/plain'});

    it('returns a string', async () => {
      const result = await PayloadProcessor.blobToString(b);
      assert.typeOf(result, 'string')
    });

    it('returns a valid data url', async () => {
      const result = await PayloadProcessor.blobToString(b);
      assert.equal(result, 'data:text/plain;base64,Kioq');
    });
  });

  describe('dataURLtoBlob()', () => {
    const data = 'data:text/plain;base64,Kioq';

    it('converts data-url to a blob', () => {
      const result = PayloadProcessor.dataURLtoBlob(data);
      assert.typeOf(result, 'blob');
    });

    it('restores the type', () => {
      const result = PayloadProcessor.dataURLtoBlob(data);
      assert.equal(result.type, 'text/plain');
    });

    it('matches the size', () => {
      const result = PayloadProcessor.dataURLtoBlob(data);
      assert.equal(result.size, 3);
    });
  });

  describe('createMultipartEntry()', () => {
    let fd = /** @type FormData */ (null);
    beforeEach(() => {
      const b = new Blob(['***'], {type: 'text/plain'});
      fd = new FormData();
      fd.append('file', b, 'file-name');
      fd.append('text', 'abcd');
      fd.append('text-part', b, 'blob');
    });

    it('returns an array with transformed items', async () => {
      const result = await PayloadProcessor.createMultipartEntry(fd);
      assert.typeOf(result, 'array');
      assert.lengthOf(result, 3);
    });

    it('computes the file part', async () => {
      const data = await PayloadProcessor.createMultipartEntry(fd);
      const [part] = data;
      assert.isTrue(part.isFile, 'isFile is set');
      assert.equal(part.name, 'file', 'name is set');
      assert.equal(part.value, 'data:text/plain;base64,Kioq', 'value is transformed');
      assert.equal(part.fileName, 'file-name', 'fileName is set');
      assert.isUndefined(part.type, 'type is not set');
    });

    it('computes the text part', async () => {
      const data = await PayloadProcessor.createMultipartEntry(fd);
      const part = data[1];
      assert.isFalse(part.isFile, 'isFile is not set');
      assert.equal(part.name, 'text', 'name is set');
      assert.equal(part.value, 'abcd', 'value is not transformed');
      assert.isUndefined(part.fileName, 'fileName is not set');
      assert.isUndefined(part.type, 'type is not set');
    });

    it('computes the text part with a content type', async () => {
      const data = await PayloadProcessor.createMultipartEntry(fd);
      const part = data[2];
      assert.isFalse(part.isFile, 'isFile is not set');
      assert.equal(part.type, 'text/plain');
      assert.equal(part.name, 'text-part');
      assert.equal(part.value, 'data:text/plain;base64,Kioq');
    });
  });

  describe('restoreMultipart()', () => {
    it('returns empty FormData when no model', () => {
      const result = PayloadProcessor.restoreMultipart(undefined);
      assert.typeOf(result, 'formdata');
    });

    it('processes a text entry', () => {
      const fd = PayloadProcessor.restoreMultipart([{
        isFile: false,
        name: 'test-name',
        value: 'test-value'
      }]);
      const result = fd.get('test-name');
      assert.equal(result, 'test-value');
    });

    it('processes text entry with a content type', () => {
      const fd = PayloadProcessor.restoreMultipart([{
        isFile: false,
        type: 'text/plain',
        name: 'test-name',
        value: 'data:text/plain;base64,Kioq'
      }]);
      const result = fd.get('test-name');
      // @ts-ignore
      assert.equal(result.type, 'text/plain');
    });

    it('processes a file', () => {
      const fd = PayloadProcessor.restoreMultipart([{
        isFile: true,
        name: 'test-name',
        value: 'data:text/plain;base64,Kioq'
      }]);
      const result = fd.get('test-name');
      // @ts-ignore
      assert.equal(result.type, 'text/plain');
    });
  });

  describe('restorePayload()', () => {
    it('does nothing when no created payload data', () => {
      const result = PayloadProcessor.restorePayload({ ...initRequest });
      assert.deepEqual(result, initRequest);
    });

    it('restores a blob data', () => {
      const data = 'data:text/plain;base64,Kioq';
      const result = PayloadProcessor.restorePayload({
        ...initRequest,
        blob: data,
      });
      assert.typeOf(result.payload, 'blob');
      // @ts-ignore
      assert.equal(result.payload.type, 'text/plain');
      // @ts-ignore
      assert.equal(result.payload.size, 3);
      assert.isUndefined(result.blob);
    });

    it('restores a form data', () => {
      const result = PayloadProcessor.restorePayload({
        ...initRequest,
        multipart: [{
          isFile: false,
          name: 'test-name',
          value: 'test-value'
        }]
      });
      assert.ok(result.payload);
      // @ts-ignore
      const data = result.payload.get('test-name');
      assert.equal(data, 'test-value');
      assert.isUndefined(result.multipart);
    });
  });
});
