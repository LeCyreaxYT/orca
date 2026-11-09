const base = require('./electron-builder.config.cjs')

// Keep this test fork beside the official app, with its own profile and update source.
module.exports = {
  ...base,
  appId: 'dev.lecyreax.orca.sky',
  productName: 'Orca Sky',
  protocols: [],
  extraMetadata: {
    ...base.extraMetadata,
    name: 'orca-sky',
    productName: 'Orca Sky'
  },
  directories: { ...base.directories, output: 'dist-sky' },
  win: {
    ...base.win,
    target: [{ target: 'zip', arch: ['x64'] }],
    artifactName: 'orca-sky-windows-${arch}.${ext}',
    signtoolOptions: undefined,
    verifyUpdateCodeSignature: false
  },
  publish: { provider: 'github', owner: 'LeCyreaxYT', repo: 'orca', releaseType: 'prerelease' }
}
