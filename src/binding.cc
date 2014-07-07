#include <string.h>
#include <stdio.h>
#include <stdlib.h>

#include "v8.h"
#include "node.h"

#include "node_pointer.h"
#include "nan.h"
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
  NanCallback *callback;
};

NAN_METHOD(Open) {
  NanEscapableScope();
  int r;
  audio_output_t *ao = UnwrapPointer<audio_output_t *>(args[0]);
  memset(ao, 0, sizeof(audio_output_t));

  ao->channels = args[1]->Int32Value(); /* channels */
  ao->rate = args[2]->Int32Value(); /* sample rate */
  ao->format = args[3]->Int32Value(); /* MPG123_ENC_* format */

  /* init_output() */
  r = mpg123_output_module_info.init_output(ao);
  if (r == 0) {
    /* open() */
    r = ao->open(ao);
  }

  NanReturnValue(NanNew<v8::Integer>(r));
}

void write_async (uv_work_t *);
void write_after (uv_work_t *);

NAN_METHOD(Write) {
  NanScope();
  audio_output_t *ao = UnwrapPointer<audio_output_t *>(args[0]);
  unsigned char *buffer = UnwrapPointer<unsigned char *>(args[1]);
  int len = args[2]->Int32Value();

  write_req *req = new write_req;
  req->ao = ao;
  req->buffer = buffer;
  req->len = len;
  req->written = 0;
  req->callback = new NanCallback(args[3].As<Function>());

  req->req.data = req;

  uv_queue_work(uv_default_loop(), &req->req, write_async, (uv_after_work_cb)write_after);

  NanReturnUndefined();
}

void write_async (uv_work_t *req) {
  write_req *wreq = reinterpret_cast<write_req *>(req->data);
  wreq->written = wreq->ao->write(wreq->ao, wreq->buffer, wreq->len);
}

void write_after (uv_work_t *req) {
  NanScope();
  write_req *wreq = reinterpret_cast<write_req *>(req->data);

  Handle<Value> argv[] = {
    NanNew<v8::Integer>(wreq->written)
  };

  wreq->callback->Call(1, argv);

  delete wreq->callback;
}

NAN_METHOD(Flush) {
  NanScope();
  audio_output_t *ao = UnwrapPointer<audio_output_t *>(args[0]);
  /* TODO: async */
  ao->flush(ao);
  NanReturnUndefined();
}

NAN_METHOD(Close) {
  NanEscapableScope();
  audio_output_t *ao = UnwrapPointer<audio_output_t *>(args[0]);
  ao->close(ao);
  int r = 0;
  if (ao->deinit) {
    r = ao->deinit(ao);
  }
  NanReturnValue(NanNew<v8::Integer>(r));
}

void Initialize(Handle<Object> target) {
  NanScope();
  target->Set(NanNew<v8::String>("api_version"), NanNew<v8::Integer>(mpg123_output_module_info.api_version));
  target->Set(NanNew<v8::String>("name"), NanNew<v8::String>(mpg123_output_module_info.name));
  target->Set(NanNew<v8::String>("description"), NanNew<v8::String>(mpg123_output_module_info.description));
  target->Set(NanNew<v8::String>("revision"), NanNew<v8::String>(mpg123_output_module_info.revision));

  audio_output_t ao;
  memset(&ao, 0, sizeof(audio_output_t));
  mpg123_output_module_info.init_output(&ao);
  ao.channels = 2;
  ao.rate = 44100;
  ao.format = MPG123_ENC_SIGNED_16;
  ao.open(&ao);
  target->Set(NanNew<v8::String>("formats"), NanNew<v8::Integer>(ao.get_formats(&ao)));
  ao.close(&ao);

  target->Set(NanNew<v8::String>("sizeof_audio_output_t"), NanNew<v8::Integer>(sizeof(audio_output_t)));

#define CONST_INT(value) \
  target->Set(NanNew<v8::String>(#value), NanNew<v8::Integer>(value), \
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

  NODE_SET_METHOD(target, "open", Open);
  NODE_SET_METHOD(target, "write", Write);
  NODE_SET_METHOD(target, "flush", Flush);
  NODE_SET_METHOD(target, "close", Close);
}

} // anonymous namespace

NODE_MODULE(binding, Initialize)
