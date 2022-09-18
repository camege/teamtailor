const expect = require('chai').expect;
const app = require('../app');
console.log(typeof app.make_api_call); // => 'function'
describe('Simple API Test', () => {
 it('should contain the key "data"', async () => {
        const response = await app.make_api_call("https://api.teamtailor.com/v1/candidates?page[number]=1");
        expect(response).to.contain.any.keys("data"); 
    });
});