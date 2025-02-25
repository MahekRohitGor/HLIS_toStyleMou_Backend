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

    async complete_profile(req,res){
        var request_data = req.body;
        userModel.complete_profile(request_data, request_data.user_id, (_response_data)=>{
            common.response(res, _response_data);
        });
    }

    async trending_posts(req,res){
        var request_data = req.body;
        userModel.trending_posts(request_data, (_response_data)=>{
            common.response(res, _response_data);
        });
    }

    async add_post(req,res){
        var request_data = req.body;
        userModel.add_post(request_data, (_response_data)=>{
            common.response(res, _response_data);
        });
    }

    async get_post_ranks(req,res){
        var request_data = req.body;
        userModel.get_post_ranks(request_data, request_data.user_id, (_response_data)=>{
            common.response(res, _response_data);
        });
    }

    async get_notifications(req,res){
        var request_data = req.body;
        userModel.get_notifications(request_data, request_data.user_id, (_response_data)=>{
            common.response(res, _response_data);
        });
    }
    
    async follow_user(req,res){
        var request_data = req.body;
        userModel.follow_user(request_data, request_data.user_id, (_response_data)=>{
            common.response(res, _response_data);
        });
    }
    async rate_post(req,res){
        var request_data = req.body;
        userModel.rate_post(request_data, request_data.user_id, (_response_data)=>{
            common.response(res, _response_data);
        });
    }
    async get_profile(req,res){
        var request_data = req.body;
        userModel.get_profile(request_data, request_data.user_id, (_response_data)=>{
            common.response(res, _response_data);
        });
    }
    async get_other_profile(req,res){
        var request_data = req.body;
        var user_id = req.params.id;
        userModel.get_other_profile(request_data, user_id, (_response_data)=>{
            common.response(res, _response_data);
        });
    }
    async filter(req,res){
        var request_data = req.body;
        userModel.filter(request_data, (_response_data)=>{
            common.response(res, _response_data);
        });
    }

    async get_followers(req,res){
        var request_data = req.body;
        userModel.get_followers(request_data, request_data.user_id, (_response_data)=>{
            common.response(res, _response_data);
        });
    }

    async get_following(req,res){
        var request_data = req.body;
        userModel.get_following(request_data, request_data.user_id, (_response_data)=>{
            common.response(res, _response_data);
        });
    }

}

module.exports = new User();