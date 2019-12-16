#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define NAPI_VERSION 1
#include <node_api.h>

#include "output.h"

extern mpg123_module_t mpg123_output_module_info;

typedef struct {
  char *device;
  audio_output_t ao;
} Speaker;

typedef struct {
  audio_output_t *ao;

  size_t length;
  size_t written;
  unsigned char* buffer;

  napi_deferred deferred;
} WriteData;

bool is_string(napi_env env, napi_value value) {
  napi_valuetype valuetype;
  assert(napi_typeof(env, value, &valuetype) == napi_ok);
  return valuetype == napi_string;
}

void finalize(napi_env env, void* data, void* hint) {
  // FIXME: Maybe close here?
  free(data);
}

napi_value speaker_open(napi_env env, napi_callback_info info) {
  size_t argc = 4;
  napi_value args[4];
  assert(napi_get_cb_info(env, info, &argc, args, NULL, NULL) == napi_ok);

  Speaker *speaker = malloc(sizeof(Speaker));
  memset(speaker, 0, sizeof(Speaker));
  audio_output_t *ao = &speaker->ao;

  assert(napi_get_value_int32(env, args[0], &ao->channels) == napi_ok); /* channels */
  int32_t _rate;
  assert(napi_get_value_int32(env, args[1], &_rate) == napi_ok); /* sample rate */
  ao->rate = _rate;
  assert(napi_get_value_int32(env, args[2], &ao->format) == napi_ok); /* MPG123_ENC_* format */

  if (is_string(env, args[3])) {
    size_t device_string_size;
    assert(napi_get_value_string_utf8(env, args[3], NULL, 0, &device_string_size) == napi_ok);
    speaker->device = malloc(++device_string_size);
    assert(napi_get_value_string_utf8(env, args[3], speaker->device, device_string_size, NULL) == napi_ok);
    assert(speaker->device[device_string_size - 1] == 0);
    ao->device = speaker->device;
  }

  /* init_output() */
  int r = mpg123_output_module_info.init_output(ao);

  if (r != 0) {
    napi_throw_error(env, "ERR_OPEN", "Failed to initialize output device");
    return NULL;
  }

  /* open() */
  r = ao->open(ao);

  if (r != 0) {
    napi_throw_error(env, "ERR_OPEN", "Failed to open output device");
    return NULL;
  }

  napi_value handle;
  assert(napi_create_object(env, &handle) == napi_ok);
  assert(napi_wrap(env, handle, speaker, finalize, NULL, NULL) == napi_ok);

  return handle;
}

void write_execute(napi_env env, void* _data) {
  WriteData* data = _data;

  data->written = data->ao->write(data->ao, data->buffer, data->length);
}

void write_complete(napi_env env, napi_status status, void* _data) {
  WriteData* data = _data;

  napi_value written;
  assert(napi_create_uint32(env, data->written, &written) == napi_ok);
  assert(napi_resolve_deferred(env, data->deferred, written) == napi_ok);

  free(_data);
}

napi_value speaker_write(napi_env env, napi_callback_info info) {
  size_t argc = 2;
  napi_value args[2];
  assert(napi_get_cb_info(env, info, &argc, args, NULL, NULL) == napi_ok);

  Speaker *speaker;
  assert(napi_unwrap(env, args[0], (void**) &speaker) == napi_ok);

  WriteData* data = malloc(sizeof(WriteData));
  data->ao = &speaker->ao;
  data->written = 0;
  assert(napi_get_typedarray_info(env, args[1], NULL, &data->length, (void **) &data->buffer, NULL, NULL) == napi_ok);

  napi_value promise;
  assert(napi_create_promise(env, &data->deferred, &promise) == napi_ok);

  napi_value work_name;
  assert(napi_create_string_utf8(env, "speaker:write", NAPI_AUTO_LENGTH, &work_name) == napi_ok);

  napi_async_work work;
  assert(napi_create_async_work(env, NULL, work_name, write_execute, write_complete, (void*) data, &work) == napi_ok);

  assert(napi_queue_async_work(env, work) == napi_ok);

  return promise;
}

napi_value speaker_flush(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value args[1];
  assert(napi_get_cb_info(env, info, &argc, args, NULL, NULL) == napi_ok);

  Speaker *speaker;
  assert(napi_unwrap(env, args[0], (void**) &speaker) == napi_ok);
  audio_output_t *ao = &speaker->ao;

  /* TODO: async */
  ao->flush(ao);
  return NULL;
}

napi_value speaker_close(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value args[1];
  assert(napi_get_cb_info(env, info, &argc, args, NULL, NULL) == napi_ok);

  Speaker *speaker;
  assert(napi_unwrap(env, args[0], (void**) &speaker) == napi_ok);
  audio_output_t *ao = &speaker->ao;

  int r = ao->close(ao);

  if (r != 0) {
    napi_throw_error(env, "ERR_CLOSE", "Failed to initialize output device");
    goto cleanup;
  }

  if (ao->deinit) {
    int r = ao->deinit(ao);

    if (r != 0) {
      napi_throw_error(env, "ERR_CLOSE", "Failed to initialize output device");
      goto cleanup;
    }
  }

cleanup:
  free(speaker->device);
  return NULL;
}

int get_formats() {
  audio_output_t ao;
  memset(&ao, 0, sizeof(audio_output_t));
  mpg123_output_module_info.init_output(&ao);
  ao.channels = 2;
  ao.rate = 44100;
  ao.format = MPG123_ENC_SIGNED_16;
  ao.open(&ao);

  int formats = ao.get_formats(&ao);

  ao.close(&ao);

  return formats;
}


static napi_value Init(napi_env env, napi_value exports) {
  napi_value result;
  assert(napi_create_object(env, &result) == napi_ok);

  napi_value api_version;
  assert(napi_create_int32(env, mpg123_output_module_info.api_version, &api_version) == napi_ok);
  assert(napi_set_named_property(env, result, "api_version", api_version) == napi_ok);

  napi_value name;
  assert(napi_create_string_latin1(env, mpg123_output_module_info.name, NAPI_AUTO_LENGTH, &name) == napi_ok);
  assert(napi_set_named_property(env, result, "name", name) == napi_ok);

  napi_value description;
  assert(napi_create_string_latin1(env, mpg123_output_module_info.description, NAPI_AUTO_LENGTH, &description) == napi_ok);
  assert(napi_set_named_property(env, result, "description", description) == napi_ok);

  napi_value revision;
  assert(napi_create_string_latin1(env, mpg123_output_module_info.revision, NAPI_AUTO_LENGTH, &revision) == napi_ok);
  assert(napi_set_named_property(env, result, "revision", revision) == napi_ok);

  napi_value formats;
  assert(napi_create_int32(env, get_formats(), &formats) == napi_ok);
  assert(napi_set_named_property(env, result, "formats", formats) == napi_ok);

#define CONST_INT(NAME) \
  napi_value NAME ## _value;\
  assert(napi_create_uint32(env, NAME, & NAME ## _value) == napi_ok);\
  assert(napi_set_named_property(env, result, #NAME, NAME ## _value) == napi_ok);

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

#undef CONST_INT

  napi_value open_fn;
  assert(napi_create_function(env, "open", NAPI_AUTO_LENGTH, speaker_open, NULL, &open_fn) == napi_ok);
  assert(napi_set_named_property(env, result, "open", open_fn) == napi_ok);

  napi_value write_fn;
  assert(napi_create_function(env, "write", NAPI_AUTO_LENGTH, speaker_write, NULL, &write_fn) == napi_ok);
  assert(napi_set_named_property(env, result, "write", write_fn) == napi_ok);

  napi_value flush_fn;
  assert(napi_create_function(env, "flush", NAPI_AUTO_LENGTH, speaker_flush, NULL, &flush_fn) == napi_ok);
  assert(napi_set_named_property(env, result, "flush", flush_fn) == napi_ok);

  napi_value close_fn;
  assert(napi_create_function(env, "close", NAPI_AUTO_LENGTH, speaker_close, NULL, &close_fn) == napi_ok);
  assert(napi_set_named_property(env, result, "close", close_fn) == napi_ok);

  return result;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
