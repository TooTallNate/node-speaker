#include <string.h>
#include <stdio.h>
#include <stdlib.h>

#include "node_pointer.h"
#include "out123.h"

using namespace v8;
using namespace node;

namespace {

struct write_req {
  uv_work_t req;
  out123_handle *ao;
  unsigned char *buffer;
  int len;
  int written;
  Nan::Callback *callback;
};

NAN_METHOD(New) {
  Nan::EscapableHandleScope scope;
  out123_handle *ao = out123_new();
}

NAN_METHOD(Open) {
  Nan::EscapableHandleScope scope;
  int r;
  out123_handle *ao = UnwrapPointer<out123_handle *>(info[0]);
  memset(ao, 0, sizeof(out123_handle));



  ao->channels = info[1]->Int32Value(); /* channels */
  ao->rate = info[2]->Int32Value(); /* sample rate */
  ao->format = info[3]->Int32Value(); /* MPG123_ENC_* format */

  if (info[4]->IsString()) {
    v8::Local<v8::String> deviceString = info[4]->ToString();
    ao->device = new char[deviceString->Length() + 1];
    deviceString->WriteOneByte(reinterpret_cast<uint8_t *>(ao->device));
  }

  /* init_output() */
  r = mpg123_output_module_info.init_output(ao);
  if (r == 0) {
    /* open() */
    r = ao->open(ao);
  }

  info.GetReturnValue().Set(scope.Escape(Nan::New<v8::Integer>(r)));
}

void write_async (uv_work_t *);
void write_after (uv_work_t *);

NAN_METHOD(Write) {
  Nan::HandleScope scope;
  out123_handle *ao = UnwrapPointer<out123_handle *>(info[0]);
  unsigned char *buffer = UnwrapPointer<unsigned char *>(info[1]);
  int len = info[2]->Int32Value();

  write_req *req = new write_req;
  req->ao = ao;
  req->buffer = buffer;
  req->len = len;
  req->written = 0;
  req->callback = new Nan::Callback(info[3].As<Function>());

  req->req.data = req;

  uv_queue_work(uv_default_loop(), &req->req, write_async, (uv_after_work_cb)write_after);

  info.GetReturnValue().SetUndefined();
}

void write_async (uv_work_t *req) {
  write_req *wreq = reinterpret_cast<write_req *>(req->data);
  wreq->written = wreq->ao->write(wreq->ao, wreq->buffer, wreq->len);
}

void write_after (uv_work_t *req) {
  Nan::HandleScope scope;
  write_req *wreq = reinterpret_cast<write_req *>(req->data);

  Local<Value> argv[] = {
    Nan::New(wreq->written)
  };

  wreq->callback->Call(1, argv);

  delete wreq->callback;
}

NAN_METHOD(Flush) {
  Nan::HandleScope scope;
  out123_handle *ao = UnwrapPointer<out123_handle *>(info[0]);
  /* TODO: async */
  out123_drain(ao);
  info.GetReturnValue().SetUndefined();
}

NAN_METHOD(Close) {
  Nan::EscapableHandleScope scope;
  out123_handle *ao = UnwrapPointer<out123_handle *>(info[0]);
  ao->close(ao);
  int r = 0;
  if (ao->deinit) {
    r = ao->deinit(ao);
  }
  delete ao->device;
  info.GetReturnValue().Set(scope.Escape(Nan::New<v8::Integer>(r)));
}

void Initialize(Handle<Object> target) {
  Nan::HandleScope scope;

  // out123_handle ao;
  // memset(&ao, 0, sizeof(out123_handle));

  // ao.channels = 2;
  // ao.rate = 44100;
  // ao.format = MPG123_ENC_SIGNED_16;
  // ao.open(&ao);

  // out123_open(&out123_handle, nullptr, nullptr);

  // Nan::ForceSet(target, Nan::New("formats").ToLocalChecked(), Nan::New(ao.get_formats(&ao)));
  // ao.close(&ao);

  target->Set(Nan::New("sizeof_out123_handle").ToLocalChecked(),
              Nan::New(static_cast<uint32_t>(sizeof(out123_handle))));

// #define CONST_INT(value) \
//   Nan::ForceSet(target, Nan::New(#value).ToLocalChecked(), Nan::New(value), \
//       static_cast<PropertyAttribute>(ReadOnly|DontDelete));

//   CONST_INT(MPG123_ENC_FLOAT_32);
//   CONST_INT(MPG123_ENC_FLOAT_64);
//   CONST_INT(MPG123_ENC_SIGNED_8);
//   CONST_INT(MPG123_ENC_UNSIGNED_8);
//   CONST_INT(MPG123_ENC_SIGNED_16);
//   CONST_INT(MPG123_ENC_UNSIGNED_16);
//   CONST_INT(MPG123_ENC_SIGNED_24);
//   CONST_INT(MPG123_ENC_UNSIGNED_24);
//   CONST_INT(MPG123_ENC_SIGNED_32);
//   CONST_INT(MPG123_ENC_UNSIGNED_32);

  Nan::SetMethod(target, "open", Open);
  Nan::SetMethod(target, "write", Write);
  Nan::SetMethod(target, "flush", Flush);
  Nan::SetMethod(target, "close", Close);
}

} // anonymous namespace

NODE_MODULE(binding, Initialize)
