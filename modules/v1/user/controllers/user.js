var userModel = require("../models/user_model");
var common = require("../../../../utilities/common");
const response_code = require("../../../../utilities/response-error-code");

class User{

    async signup(req,res){
        var request_data = req.body;
        userModel.signup(request_data, (_response_data)=>{
            common.response(res, _response_data);
        });
    }

    async login(req,res){
        var request_data = req.body;
        userModel.login(request_data, (_response_data)=>{
            common.response(res, _response_data);
        });
    }

    async logout(req,res){
        var request_data = req.body;
        userModel.logout(request_data, (_response_data)=>{
            common.response(res, _response_data);
        });
    }

    async forgot_password(req,res){
        var request_data = req.body;
        userModel.forgot_password(request_data, (_response_data)=>{
            common.response(res, _response_data);
        });
    }

    async reset_password(req,res){
        var request_data = req.body;
        userModel.reset_password(request_data, (_response_data)=>{
            common.response(res, _response_data);
        });
    }

    
    

}

module.exports = new User();