const User = require("../controllers/user");
const middleware = require("../../../../middlewares/data_validation");

const user = (app) =>{
    app.post("/v1/user/signup", User.signup);
    app.post("/v1/user/login", User.login);
    app.post("/v1/user/logout", User.logout);
    app.post("/v1/user/forgot-pass", User.forgot_password);
    app.post("/v1/user/reset-pass", User.reset_password);
}

module.exports = user;