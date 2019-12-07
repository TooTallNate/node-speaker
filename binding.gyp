{
  'targets': [
    {
      'target_name': 'binding',
      'sources': [
        'src/binding.c',
      ],
      'dependencies': [
        'deps/mpg123/mpg123.gyp:output'
      ],
    }
  ]
}
