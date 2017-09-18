#include <string.h>
#include <stdio.h>
#include <stdlib.h>

#include "node_pointer.h"
#include "output.h"

using namespace v8;
using namespace node;

extern mpg123_module_t mpg123_output_module_info;

namespace {

struct write_req {
  uv_work_t req;
  audio_output_t *ao;
  unsigned char *buffer;
  int len;
  int written;
  Nan::Callback *callback;
};

NAN_METHOD(Open) {
  Nan::EscapableHandleScope scope;
  int r;
  audio_output_t *ao = UnwrapPointer<audio_output_t *>(info[0]);
  memset(ao, 0, sizeof(audio_output_t));

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
  audio_output_t *ao = UnwrapPointer<audio_output_t *>(info[0]);
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
  audio_output_t *ao = UnwrapPointer<audio_output_t *>(info[0]);
  /* TODO: async */
  ao->flush(ao);
  info.GetReturnValue().SetUndefined();
}

NAN_METHOD(Close) {
  Nan::EscapableHandleScope scope;
  audio_output_t *ao = UnwrapPointer<audio_output_t *>(info[0]);
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
  Nan::ForceSet(target,
                Nan::New("api_version").ToLocalChecked(),
                Nan::New(mpg123_output_module_info.api_version));
  Nan::ForceSet(target,
                Nan::New("name").ToLocalChecked(),
                Nan::New(mpg123_output_module_info.name).ToLocalChecked());
  Nan::ForceSet(target,
                Nan::New("description").ToLocalChecked(),
                Nan::New(mpg123_output_module_info.description).ToLocalChecked());
  Nan::ForceSet(target,
                Nan::New("revision").ToLocalChecked(),
                Nan::New(mpg123_output_module_info.revision).ToLocalChecked());

  audio_output_t ao;
  memset(&ao, 0, sizeof(audio_output_t));
  mpg123_output_module_info.init_output(&ao);
  ao.channels = 2;
  ao.rate = 44100;
  ao.format = MPG123_ENC_SIGNED_16;
  ao.open(&ao);
  Nan::ForceSet(target, Nan::New("formats").ToLocalChecked(), Nan::New(ao.get_formats(&ao)));
  ao.close(&ao);

  target->Set(Nan::New("sizeof_audio_output_t").ToLocalChecked(),
              Nan::New(static_cast<uint32_t>(sizeof(audio_output_t))));

#define CONST_INT(value) \
  Nan::ForceSet(target, Nan::New(#value).ToLocalChecked(), Nan::New(value), \
      static_cast<PropertyAttribute>(ReadOnly|DontDelete));

  CONST_INT(MPG123_ENC_FLOAT_32);
  CONST_INT(MPG123_ENC_FLOAT_64);
  CONST_INT(MPG123_ENC_SIGNED_8);
  CONST_INT(MPG123_ENC_UNSIGNED_8);
  CONST_INT(MPG123_ENC_SIGNED_16);
  CONST_INT(MPG123_ENC_UNSIGNED_16);
  CONST_INT(MPG123_ENC_SIGNED_24);
  CONST_INT(MPG123_ENC_UNSIGNED_24);
  CONST_INT(MPG123_ENC_SIGNED_32);
  CONST_INT(MPG123_ENC_UNSIGNED_32);

  Nan::SetMethod(target, "open", Open);
  Nan::SetMethod(target, "write", Write);
  Nan::SetMethod(target, "flush", Flush);
  Nan::SetMethod(target, "close", Close);
}

} // anonymous namespace

NODE_MODULE(binding, Initialize)
