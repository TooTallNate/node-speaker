{
  'variables': {
    'target_arch%': 'ia32',
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
          ['target_arch=="ia32"', { 'xcode_settings': { 'ARCHS': [ 'i386' ] } }],
          ['target_arch=="x64"', { 'xcode_settings': { 'ARCHS': [ 'x86_64' ] } }]
        ],
      }],
    ]
  },

  'targets': [
    {
      'target_name': 'libout123',
      'product_prefix': 'lib',
      'type': 'static_library',
      'variables': {
        'conditions': [
          # "mpg123_cpu" is the cpu optimization to use
          # Windows uses "i386_fpu" even on x64 to avoid compiling .S asm files
          # (I don't think the 64-bit ASM files are compatible with `ml`/`ml64`...)
          ['OS=="win"', { 'mpg123_cpu%': 'i386_fpu' },
          { 'conditions': [
            ['target_arch=="arm"', { 'mpg123_cpu%': 'arm_nofpu' }],
            ['target_arch=="ia32"', { 'mpg123_cpu%': 'i386_fpu' }],
            ['target_arch=="x64"', { 'mpg123_cpu%': 'x86-64' }],
          ]}],
        ]
      },
      'sources': [
        'buffer.c',
        'legacy_module.c',
        'libout123.c',
        'module.c',
        'sfifo.c',
        'stringlists.c',
        'wav.c',
        'xfermem.c',
      ],
      'defines': [
        'PIC',
        'NOXFERMEM',
        'HAVE_CONFIG_H',
      ],
      'conditions': [
        ['mpg123_cpu=="arm_nofpu"', {
          'defines': [
            'OPT_ARM',
            'REAL_IS_FIXED',
            'NEWOLD_WRITE_SAMPLE',
          ],
        }],
        ['mpg123_cpu=="i386_fpu"', {
          'defines': [
            'OPT_I386',
            'REAL_IS_FLOAT',
            'NEWOLD_WRITE_SAMPLE',
          ],
        }],
        ['mpg123_cpu=="x86-64"', {
          'defines': [
            'OPT_X86_64',
            'REAL_IS_FLOAT',
          ],
        }],
      ],
    },

    {
      'target_name': 'output',
      'product_prefix': 'lib',
      'type': 'static_library',
      'variables': {
        'conditions': [
          # "mpg123_backend" is the audio backend to use
          ['OS=="mac"', { 'mpg123_backend%': 'coreaudio' }],
          ['OS=="win"', { 'mpg123_backend%': 'win32' }],
          ['OS=="linux"', { 'mpg123_backend%': 'alsa' }],
          ['OS=="freebsd"', { 'mpg123_backend%': 'alsa' }],
          ['OS=="solaris"', { 'mpg123_backend%': 'sun' }],
        ]
      },
      'include_dirs': [
        'modules',
      ],
      'defines': [
        'PIC',
        'NOXFERMEM',
        'REAL_IS_FLOAT',
        'HAVE_CONFIG_H',
        'BUILDING_OUTPUT_MODULES=1'
      ],
      'direct_dependent_settings': {
        'include_dirs': [
          'modules',
        ]
      },
      'conditions': [
        ['mpg123_backend=="alsa"', {
          'link_settings': {
            'libraries': [
              '-lasound',
            ]
          }
        }],
        ['mpg123_backend=="coreaudio"', {
          'link_settings': {
            'libraries': [
              '-framework AudioToolbox',
              '-framework AudioUnit',
              '-framework CoreServices',
            ],
          },
        }],
        ['mpg123_backend=="openal"', {
          'defines': [
            'OPENAL_SUBDIR_OPENAL'
          ],
          'link_settings': {
            'libraries': [
              '-framework OpenAL',
            ]
          }
        }],
        ['mpg123_backend=="win32"', {
          'link_settings': {
            'libraries': [
              '-lwinmm.lib',
            ],
          }
        }],
        ['mpg123_backend=="pulse"', {
          'link_settings': {
            'libraries': [
              '-lpulse',
              '-lpulse-simple',
            ],
          }
        }],
        ['mpg123_backend=="jack"', {
          'link_settings': {
            'libraries': [
              '-ljack',
            ],
          }
        }],
      ],
      'sources': [ 'modules/<(mpg123_backend).c' ],
    }
  ]
}
