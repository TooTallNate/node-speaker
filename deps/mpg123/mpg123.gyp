# This file is used with the GYP meta build system.
# http://code.google.com/p/gyp
# To build try this:
#   svn co http://gyp.googlecode.com/svn/trunk gyp
#   ./gyp/gyp -f make --depth=. mpg123.gyp
#   make
#   ./out/Debug/test

{
  'variables': {
    'target_arch%': 'ia32',
    'conditions': [
      ['OS=="mac"', { 'output_module%': 'coreaudio' }],
      ['OS=="win"', { 'output_module%': 'win32' }],
      ['OS=="linux"', { 'output_module%': 'alsa' }],
    ]
  },
  'target_defaults': {
    'default_configuration': 'Debug',
    'configurations': {
      'Debug': {
        'defines': [ 'DEBUG', '_DEBUG' ],
        'msvs_settings': {
          'VCCLCompilerTool': {
            'RuntimeLibrary': 1, # static debug
          },
        },
      },
      'Release': {
        'defines': [ 'NDEBUG' ],
        'msvs_settings': {
          'VCCLCompilerTool': {
            'RuntimeLibrary': 0, # static release
          },
        },
      }
    },
    'msvs_settings': {
      'VCLinkerTool': {
        'GenerateDebugInformation': 'true',
      },
    },
    'conditions': [
      ['OS=="mac"', {
        'conditions': [
          ['target_arch=="ia32"', {
            'xcode_settings': {
              'ARCHS': [ 'i386' ]
            },
          }],
          ['target_arch=="x64"', {
            'xcode_settings': {
              'ARCHS': [ 'x86_64' ]
            },
          }]
        ],
      }],
    ]
  },

  'targets': [
    {
      'target_name': 'mpg123',
      'product_prefix': 'lib',
      'type': 'static_library',
      'sources': [
        'src/libmpg123/compat.c',
        'src/libmpg123/parse.c',
        'src/libmpg123/frame.c',
        'src/libmpg123/format.c',
        'src/libmpg123/dct64.c',
        'src/libmpg123/equalizer.c',
        'src/libmpg123/id3.c',
        'src/libmpg123/optimize.c',
        'src/libmpg123/readers.c',
        'src/libmpg123/tabinit.c',
        'src/libmpg123/libmpg123.c',
        'src/libmpg123/index.c',
        'src/libmpg123/stringbuf.c',
        'src/libmpg123/icy.c',
        'src/libmpg123/icy2utf8.c',
        'src/libmpg123/ntom.c',
        'src/libmpg123/synth.c',
        'src/libmpg123/synth_8bit.c',
        'src/libmpg123/layer1.c',
        'src/libmpg123/layer2.c',
        'src/libmpg123/layer3.c',
        'src/libmpg123/synth_s32.c',
        'src/libmpg123/synth_real.c',
        'src/libmpg123/dither.c',
        'src/libmpg123/feature.c',
        'src/libmpg123/lfs_alias.c',
      ],
      'include_dirs': [
        'src/libmpg123',
        # platform and arch-specific headers
        'config/<(OS)/<(target_arch)',
      ],
      'defines': [
        'PIC',
        'HAVE_CONFIG_H'
      ],
      'direct_dependent_settings': {
        'include_dirs': [
          'src/libmpg123',
          # platform and arch-specific headers
          'config/<(OS)/<(target_arch)',
        ]
      },
      'conditions': [
        ['target_arch=="ia32"', {
          'defines': [
            'OPT_I386',
            'REAL_IS_FLOAT',
            'NEWOLD_WRITE_SAMPLE',
          ],
          'sources': [
            'src/libmpg123/dct64_i386.c',
          ],
        }],
        ['target_arch=="x64"', {
          'defines': [
            'OPT_MULTI',
            'OPT_X86_64',
            'OPT_GENERIC',
            'OPT_GENERIC_DITHER',
            'REAL_IS_FLOAT',
          ],
          'sources': [
            'src/libmpg123/dct64_x86_64.S',
            'src/libmpg123/dct64_x86_64_float.S',
            'src/libmpg123/synth_x86_64_float.S',
            'src/libmpg123/synth_x86_64_s32.S',
            'src/libmpg123/synth_stereo_x86_64_float.S',
            'src/libmpg123/synth_stereo_x86_64_s32.S',
            'src/libmpg123/synth_x86_64.S',
            'src/libmpg123/synth_stereo_x86_64.S',
          ],
        }],
        ['OS=="mac"', {
          'conditions': [
            ['target_arch=="ia32"', {
              'sources': [
                'src/libmpg123/getcpuflags.S',
              ]
            }],
          ],
        }],
      ],
    },

    {
      'target_name': 'output',
      'product_prefix': 'lib',
      'type': 'static_library',
      'include_dirs': [
        'src',
        'src/libmpg123',
        # platform and arch-specific headers
        'config/<(OS)/<(target_arch)',
      ],
      'defines': [
        'BUILDING_OUTPUT_MODULES=1'
      ],
      'direct_dependent_settings': {
        'include_dirs': [
          'src',
          'src/libmpg123',
          # platform and arch-specific headers
          'config/<(OS)/<(target_arch)',
        ]
      },
      'conditions': [
        ['output_module=="alsa"', {
          'direct_dependent_settings': {
            'libraries': [
              '-lasound',
            ]
          }
        }],
        ['output_module=="coreaudio"', {
          'direct_dependent_settings': {
            'libraries': [
              '-framework AudioToolbox',
              '-framework AudioUnit',
              '-framework CoreServices',
            ],
          },
        }],
        ['output_module=="openal"', {
          'defines': [
            'OPENAL_SUBDIR_OPENAL'
          ],
          'direct_dependent_settings': {
            'libraries': [
              '-framework OpenAL',
            ]
          }
        }],
      ],
      'sources': [ 'src/output/<(output_module).c' ],
    },

    {
      'target_name': 'test',
      'type': 'executable',
      'dependencies': [ 'mpg123' ],
      'sources': [ 'test.c' ]
    },

    {
      'target_name': 'output_test',
      'type': 'executable',
      'dependencies': [ 'output' ],
      'sources': [ 'test_output.c' ]
    }
  ]
}
