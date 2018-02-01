{
  'targets': [
    {
      'target_name': 'binding',
      'sources': [
        'src/binding.cc',
      ],
      'include_dirs' : [
        '<!(node -e "require(\'nan\')")'
      ],
      'conditions': [
        ['OS=="linux"', {
          'cflags': [
            '<!@(pkg-config --cflags ao)'
          ],
          'ldflags': [
            '<!@(pkg-config  --libs-only-L ao)'
          ],
          'libraries': [
            '<!@(pkg-config  --libs-only-l ao)'
          ]
        }]]
    }
  ]
}
