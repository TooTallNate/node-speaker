#include <string.h>
#include <stdio.h>
#include <stdlib.h>
#include <ao/ao.h>

#include "node_pointer.h"

using namespace v8;
using namespace node;

namespace {

struct write_req {
  uv_work_t req;
  ao_device *ao;
  char *buffer;
  int len;
  int writeok;
  Nan::Callback *callback;
};

NAN_METHOD(Open) {
  Nan::EscapableHandleScope scope;
  ao_sample_format format;
  int default_driver;
  ao_device *ao;

  memset(&format, 0, sizeof(format));
  format.channels = info[0]->Int32Value();
  format.rate = info[1]->Int32Value();
  format.bits = info[2]->Int32Value();
  format.byte_format = AO_FMT_NATIVE;

  default_driver = ao_default_driver_id();
  ao = ao_open_live(default_driver, &format, NULL);
  if (ao)
    info.GetReturnValue().Set(scope.Escape(WrapPointer(ao)));
  else
    info.GetReturnValue().SetUndefined();
}

void write_async (uv_work_t *);
void write_after (uv_work_t *);

NAN_METHOD(Write) {
  Nan::HandleScope scope;
  ao_device *ao = UnwrapPointer<ao_device *>(info[0]);
  char *buffer = UnwrapPointer<char *>(info[1]);
  int len = info[2]->Int32Value();

  write_req *req = new write_req;
  req->ao = ao;
  req->buffer = buffer;
  req->len = len;
  req->writeok = 0;
  req->callback = new Nan::Callback(info[3].As<Function>());

  req->req.data = req;

  uv_queue_work(uv_default_loop(), &req->req, write_async, (uv_after_work_cb)write_after);

  info.GetReturnValue().SetUndefined();
}

void write_async (uv_work_t *req) {
  write_req *wreq = reinterpret_cast<write_req *>(req->data);
  wreq->writeok = ao_play(wreq->ao, wreq->buffer, wreq->len);
}

void write_after (uv_work_t *req) {
  Nan::HandleScope scope;
  write_req *wreq = reinterpret_cast<write_req *>(req->data);

  Local<Value> argv[] = {
    Nan::New(wreq->writeok)
  };
  wreq->callback->Call(1, argv);
  delete wreq->callback;
}

NAN_METHOD(Close) {
  Nan::EscapableHandleScope scope;
  ao_device *ao = UnwrapPointer<ao_device *>(info[0]);
  ao_close(ao);
}

void Initialize(Handle<Object> target) {
  Nan::HandleScope scope;
  Nan::SetMethod(target, "open", Open);
  Nan::SetMethod(target, "write", Write);
  Nan::SetMethod(target, "close", Close);
  ao_initialize();
}

} // anonymous namespace

NODE_MODULE(binding, Initialize)
