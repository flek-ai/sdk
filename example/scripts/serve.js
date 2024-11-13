require('dotenv/config');

const express = require('express');
const path = require('path');
const fs = require('fs');
const child_process = require('child_process');
const chalk = require('chalk');
const appRootPath = require('app-root-path');

const mocks = path.resolve(`${appRootPath}`, '__mocks__');

const serveTranspiledFile = async (req, res, next) => {
  try {
    const { params } = req;
    const { wormhole } = params;
    const file = path.resolve(mocks, wormhole);
    if (!fs.existsSync(file)) {
      throw new Error(`Unable to find ${file}`);
    }
    const src = child_process.execSync(
      `npx babel --presets=@babel/preset-env,@babel/preset-react ${wormhole}`,
      { cwd: `${mocks}` },
    ).toString();
    return res
      .status(200)
      .send(src);
  } catch (e) {
    console.log(e);
    res.status(500).send('Internal Server Error');
  }
};

(async () => {
  const { PORT } = process.env;
  const app = express();
  app.get('/__mocks__/:wormhole', serveTranspiledFile);
  await new Promise(resolve => app.listen(PORT, resolve));
  console.clear();
  console.log(chalk.white.bold`🕳️ 🐛 Wormholes are being served!`);
  console.log('Note, request latency will be increased since files will be lazily recompiled on every request.');
  console.log(chalk.green.bold`Port: ${PORT}`);
})();
