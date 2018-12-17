#include <string.h>
#include <stdio.h>
#include <stdlib.h>
#include <chrono> //now(), duration<>
#include <map> //std::map<>

#include "node_pointer.h"
#include "output.h"

using namespace v8;
using namespace node;

extern mpg123_module_t mpg123_output_module_info;

namespace {


//helper macros:
//#define TOSTR_NESTED(str)  #str //kludge: need nested macro for this to work
//#define TOSTR(str)  TOSTR_NESTED(str)
#define HERE(n)  printf("here# " #n " @%d\n", __LINE__)


//using Now = std::chrono::high_resolution_clock::now();
auto now() { return std::chrono::high_resolution_clock::now(); } //use high res clock for more accurate progress -dj 12/15/18

//add state info to audio_output struct: -dj 12/15/18
typedef struct audio_output_MODIFIED_struct
{
	int numwr; //#writes queued
	long wrtotal; //total bytes written
//  long timestamp; //theoretical presentation time based on data samples
	decltype(now()) enque, start, finish, epoch; //= Now(); //system time of last write (enqueue, start, finish), current time
  audio_output_t original; //original untouched struct; put at end in case caller extends it
//methods:
  double elapsed_usec(decltype(now())& when)
  {
//examples at https://stackoverflow.com/questions/14391327/how-to-get-duration-as-int-millis-and-float-seconds-from-chrono
    /*std::chrono::duration<double, std::milli>*/ auto diff = when - epoch;
    return std::chrono::duration_cast<std::chrono::microseconds>(diff).count();
  }
  static int SampleSize(int fmt)
  {
    static const std::map<int, int> size_map = //map sample type => size
    {
      {MPG123_ENC_FLOAT_32, 32},
      {MPG123_ENC_FLOAT_64, 64},
      {MPG123_ENC_SIGNED_8, 8},
      {MPG123_ENC_UNSIGNED_8, 8},
      {MPG123_ENC_SIGNED_16, 16},
      {MPG123_ENC_UNSIGNED_16, 16},
      {MPG123_ENC_SIGNED_24, 24},
      {MPG123_ENC_UNSIGNED_24, 24},
      {MPG123_ENC_SIGNED_32, 32},
      {MPG123_ENC_UNSIGNED_32, 32},
    };
    return size_map.count(fmt)? size_map.find(fmt)->second / 8: 0;
  }
} audio_output_MODIFIED_t;
#define audio_output_t  audio_output_MODIFIED_t //use wedge to minimize source code changes


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

  ao->original.channels = info[1]->Int32Value(); /* channels */
  ao->original.rate = info[2]->Int32Value(); /* sample rate */
  ao->original.format = info[3]->Int32Value(); /* MPG123_ENC_* format */
	ao->epoch = now(); //remember init time -dj 12/15/18

  if (info[4]->IsString()) {
    v8::Local<v8::String> deviceString = info[4]->ToString();
    ao->original.device = new char[deviceString->Length() + 1];
    deviceString->WriteOneByte(reinterpret_cast<uint8_t *>(ao->original.device));
  }

  /* init_output() */
  if (!ao->SampleSize(ao->original.format)) r = -12345; //throw "Unknown sample size"; //check if sample fmt is handled -dj 12/15/18
  else r = mpg123_output_module_info.init_output(&ao->original);
  if (r == 0) {
    /* open() */
    r = ao->original.open(&ao->original);
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
	ao->enque = now(); //remember when write was queued (trying to measure latency) -dj 12/15/18

  req->req.data = req;

  uv_queue_work(Nan::GetCurrentEventLoop(), &req->req, write_async, (uv_after_work_cb)write_after);

  info.GetReturnValue().SetUndefined();
}

void write_async (uv_work_t *req) {
  write_req *wreq = reinterpret_cast<write_req *>(req->data);
  wreq->written = wreq->ao->original.write(&wreq->ao->original, wreq->buffer, wreq->len);
//update progress data: -dj 12/15/18
	++wreq->ao->numwr; //#writes queued
	wreq->ao->wrtotal += wreq->len; //total bytes written
	wreq->ao->start = now(); //system time of last write started
}

void write_after (uv_work_t *req) {
  Nan::HandleScope scope;
  write_req *wreq = reinterpret_cast<write_req *>(req->data);
	wreq->ao->finish = now(); //system time of last write completed -dj 12/15/18

  Local<Value> argv[] = {
    Nan::New(wreq->written)
  };

  wreq->callback->Call(1, argv);

  delete wreq->callback;
}


//added method to get playback status -dj 12/15/18
//caller can call this at precise intervals rather than receiving inprecise emitting async events
//NOTE: info is based on queued writes, but there will be latency anyway; works okay if consistent/predictable
NAN_METHOD(Progress) {
  Nan::HandleScope scope;
  audio_output_t *ao = UnwrapPointer<audio_output_t *>(info[0]);
  v8::Local<v8::Object> retval = Nan::New<v8::Object>();
//  retval->Set(Nan::New("numwr").ToLocalChecked(), info[0]->ToString());
//  HERE(2);
//  printf("&ao %p, &numwr %p @%d\n", ao, &ao->numwr, __LINE__);
//  printf("numwr %d, wrtotal %d @%d\n", ao->numwr, ao->wrtotal, __LINE__);
  Nan::ForceSet(retval, Nan::New("numwr").ToLocalChecked(), Nan::New<v8::Number>(ao->numwr)); //, static_cast<PropertyAttribute>(ReadOnly|DontDelete));
  Nan::ForceSet(retval, Nan::New("wrtotal_bytes").ToLocalChecked(), Nan::New<v8::Number>(ao->wrtotal)); //, static_cast<PropertyAttribute>(ReadOnly|DontDelete));
//get theoretical presentation time based on data samples:
  long timestamp_msec = 1000L * ao->wrtotal / ao->original.channels / ao->original.rate / ao->SampleSize(ao->original.format);
  Nan::ForceSet(retval, Nan::New("timestamp_msec").ToLocalChecked(), Nan::New<v8::Number>(timestamp_msec)); //, static_cast<PropertyAttribute>(ReadOnly|DontDelete));
//  Nan::ForceSet(retval, Nan::New("now").ToLocalChecked(), Nan::New(ao->now)); //, static_cast<PropertyAttribute>(ReadOnly|DontDelete));
//caller might have a different concept of system time, so return relative times:
//for disambiguation suggestions, see https://github.com/nodejs/nan/issues/233
  Nan::ForceSet(retval, Nan::New("enque_usec").ToLocalChecked(), Nan::New<v8::Number>(ao->elapsed_usec(ao->enque)));
  Nan::ForceSet(retval, Nan::New("start_usec").ToLocalChecked(), Nan::New<v8::Number>(ao->elapsed_usec(ao->start)));
  Nan::ForceSet(retval, Nan::New("finish_usec").ToLocalChecked(), Nan::New<v8::Number>(ao->elapsed_usec(ao->finish)));
	auto latest = now();
  Nan::ForceSet(retval, Nan::New("now_usec").ToLocalChecked(), Nan::New<v8::Number>(ao->elapsed_usec(latest)));
  info.GetReturnValue().Set(retval);
  ao->epoch = latest;
}


//TODO: broken: #define WANT_VOLUME
#ifdef WANT_VOLUME
//added methods to get/set volume -dj 12/17/18
//not sure if stream needs to be paused to call this
//api docs at https://www.mpg123.de/api/group__mpg123__voleq.shtml
NAN_METHOD(VolumeGet) {
  Nan::HandleScope scope;
  audio_output_t *ao = UnwrapPointer<audio_output_t *>(info[0]);
  double base, really, rva_db;
  int r = mpg123_get_volume(&ao->original, &base, &really, &rva_db);
  if (r) { info.GetReturnValue().Set(scope.Escape(Nan::New<v8::Integer>(r))); return; } //error
  v8::Local<v8::Object> retval = Nan::New<v8::Object>();
  Nan::ForceSet(retval, Nan::New("base").ToLocalChecked(), Nan::New<v8::Number>(base));
  Nan::ForceSet(retval, Nan::New("actual").ToLocalChecked(), Nan::New<v8::Number>(really));
  Nan::ForceSet(retval, Nan::New("rva_db").ToLocalChecked(), Nan::New<v8::Number>(rva_db));
  info.GetReturnValue().Set(retval);
}
NAN_METHOD(VolumeSet) {
  Nan::HandleScope scope;
  audio_output_t *ao = UnwrapPointer<audio_output_t *>(info[0]);
#if 1
  double vol = info[1]->DoubleValue();
  int r = mpg123_volume(&ao->original, vol);
#else
  double change = info[1]->DoubleValue();
  int r = mpg123_volume_change(&ao->original, change);
#endif
  info.GetReturnValue().Set(r);
}
#endif


NAN_METHOD(Flush) {
  Nan::HandleScope scope;
  audio_output_t *ao = UnwrapPointer<audio_output_t *>(info[0]);
  /* TODO: async */
  ao->original.flush(&ao->original);
  info.GetReturnValue().SetUndefined();
}

NAN_METHOD(Close) {
  Nan::EscapableHandleScope scope;
  audio_output_t *ao = UnwrapPointer<audio_output_t *>(info[0]);
  ao->original.close(&ao->original);
  int r = 0;
  if (ao->original.deinit) {
    r = ao->original.deinit(&ao->original);
  }
  delete ao->original.device;
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
  mpg123_output_module_info.init_output(&ao.original);
  ao.original.channels = 2;
  ao.original.rate = 44100;
  ao.original.format = MPG123_ENC_SIGNED_16;
  ao.original.open(&ao.original);
  Nan::ForceSet(target, Nan::New("formats").ToLocalChecked(), Nan::New(ao.original.get_formats(&ao.original)));
  ao.original.close(&ao.original);
	ao.epoch = now(); //remember init time -dj 12/15/18

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
//-dj 12/15/18 added:
  Nan::SetMethod(target, "progess", Progress);
#ifdef WANT_VOLUME
  Nan::SetMethod(target, "volume_get", VolumeGet);
  Nan::SetMethod(target, "volume_set", VolumeSet);
#endif
}

} // anonymous namespace

NODE_MODULE(binding, Initialize)
