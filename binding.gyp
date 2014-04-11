{
  'targets': [
    {
      'target_name': 'binding',
      'sources': [
        'src/binding.cc',
      ],
      "include_dirs" : [
        '<!(node -e "require(\'nan\')")'
      ],
      'dependencies': [
        'deps/mpg123/mpg123.gyp:output'
      ],
    }
  ]
}
