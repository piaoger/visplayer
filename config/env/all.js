'use strict';

module.exports = {
  app: {
    title: 'visPlayer',
    description: '3d online content playground',
    keywords: '3d, geometry, statistics, design, analysis, simulation, visualization'
  },
  port: process.env.PORT || 3000,
  templateEngine: 'swig',
  sessionSecret: 'MEAN',
  sessionCollection: 'sessions',
  assets: {
    lib: {
      css: [
        'public/lib/bootstrap/dist/css/bootstrap.css',
        'public/lib/bootstrap/dist/css/bootstrap-theme.css',
      ],
      js: [
        'public/lib/angular/angular.js',
        'public/lib/angular-resource/angular-resource.js',
        'public/lib/angular-cookies/angular-cookies.js',
        'public/lib/angular-animate/angular-animate.js',
        'public/lib/angular-touch/angular-touch.js',
        'public/lib/angular-sanitize/angular-sanitize.js',
        'public/lib/angular-ui-router/release/angular-ui-router.js',
        'public/lib/angular-ui-utils/ui-utils.js',
        'public/libr/angular-bootstrap/ui-bootstrap-tpls.js',
        'public/lib/ng-file-upload/angular-file-upload-shim.js',
        'public/lib/ng-file-upload/angular-file-upload.js',
        'public/lib/cryptojslib/rollups/aes.js',
        'public/lib/threejs/build/three.js',
        'public/libr/threejs/build/detector.js',
        'public/libr/threejs/build/controls/orbit-controls.js',
        'public/libr/threejs/build/controls/transform-controls.js'
      ]
    },
    css: [
      'public/modules/**/css/*.css'
    ],
    js: [
      'public/config.js',
      'public/application.js',
      'public/modules/*/*.js',
      'public/modules/*/*[!tests]*/*.js'
    ],
    tests: [
      'public/lib/angular-mocks/angular-mocks.js',
      'public/modules/*/tests/*.js'
    ]
  }
};
