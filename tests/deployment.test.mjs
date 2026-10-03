import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('Vercel routes start without CommonJS require(ESM) support', () => {
  // Reproduces the production loader restriction that crashed jwks-rsa/jose.
  const script = `
    import assert from 'node:assert/strict';
    for (const route of ['analyze', 'admin', 'garden']) {
      const { default: handler } = await import('./api/' + route + '.js');
      let result;
      const response = { setHeader() {}, end(value) { result = JSON.parse(value); } };
      await handler({ method: 'GET', headers: {} }, response);
      assert.equal(response.statusCode, 405);
      assert.equal(typeof result.error, 'string');
    }
  `;
  const result = spawnSync(process.execPath, ['--no-experimental-require-module', '--input-type=module', '-e', script], {
    cwd: fileURLToPath(new URL('..', import.meta.url)), encoding: 'utf8', timeout: 30000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
});
