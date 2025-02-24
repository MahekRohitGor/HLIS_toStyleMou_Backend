const User = require("../controllers/user");
const middleware = require("../../../../middlewares/data_validation");

const user = (app) =>{
    app.post("/v1/user/signup", User.signup);
    app.post("/v1/user/login", User.login);
}

module.exports = user;