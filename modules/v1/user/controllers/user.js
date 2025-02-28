var userModel = require("../models/user_model");
var common = require("../../../../utilities/common");
const response_code = require("../../../../utilities/response-error-code");
const {default: localizify} = require('localizify');
const validator = require("../../../../middlewares/validator");
const { t } = require('localizify');
const vrules = require("../../../validation-rules");


class User{
    async signup(req,res){
        try{
            var request_data = req.body;
            var rules = vrules.signup;
            var message = {
                required: t('required'),
                email: t('email'),
                'mobile_number.min': t('mobile_number_min'),
                'mobile_number.max': t('mobile_number_max'),
                'mobile_number.regex': t('mobile_number_numeric'),
                'passwords.min': t('passwords_min')
            }
            var keywords = {
                'email_id': t('rest_keywords_email_id'),
                'passwords': t('rest_keywords_password')
            }

            const isValid = await validator.checkValidationRules(req, res, request_data, rules, message, keywords);
            if (!isValid) return;

            userModel.signup(request_data, (_response_data) => {
                common.response(res, _response_data);
            });

        } catch(error){
            console.error("Signup error:", error);
            return common.response(res, {
                code: response_code.OPERATION_FAILED,
                message: t('rest_keywords_something_went_wrong')
            });
        }
    }
   
    async login(req,res){
        try{
            var request_data = req.body;

            var rules = vrules.login;

            var message = {
                required: t('required'),
                email: t('email'),
                'passwords.min': t('passwords_min')
            }
            var keywords = {
                'email_id': t('rest_keywords_email_id'),
                'passwords': t('rest_keywords_password')
            }

            const isValid = await validator.checkValidationRules(req, res, request_data, rules, message, keywords);
            if (!isValid) return;

            userModel.login(request_data, (_response_data)=>{
                common.response(res, _response_data);
            });

        } catch(error){
            return common.response(res, {
                code: response_code.OPERATION_FAILED,
                message: t('rest_keywords_something_went_wrong')
            });
        }
    }

    async logout(req,res){
        var request_data = req.body;
        userModel.logout(request_data, (_response_data)=>{
            common.response(res, _response_data);
        });
    }

    async forgot_password(req,res){
        try{
            var request_data = req.body;

            var rules = vrules.forgot_password;

            var message = {
                required: t('required'),
                email: t('email')
            }
            var keywords = {
                'email_id': t('rest_keywords_email_id')
            }

            const isValid = await validator.checkValidationRules(req, res, request_data, rules, message, keywords);
            if (!isValid) return;

            userModel.forgot_password(request_data, (_response_data)=>{
                common.response(res, _response_data);
            });

        } catch(error){
            return common.response(res, {
                code: response_code.OPERATION_FAILED,
                message: t('rest_keywords_something_went_wrong')
            });
        }
        
    }

    async reset_password(req,res){
        try{
            var request_data = req.body;
            var rules = vrules.reset_password;
            var message = {
                required: t('required'),
                email: t('email'),
                'new_password.min': t('passwords_min')
                // 'reset_token.min': t('token_min')

            }
            var keywords = {
                'email_id': t('rest_keywords_email_id')
            }

            const isValid = await validator.checkValidationRules(req, res, request_data, rules, message, keywords);
            if (!isValid) return;

            userModel.reset_password(request_data, (_response_data)=>{
                common.response(res, _response_data);
            });

        } catch(error){
            return common.response(res, {
                code: response_code.OPERATION_FAILED,
                message: t('rest_keywords_something_went_wrong')
            });
        }
        
    }

    async complete_profile(req,res){
        try{
            var request_data = req.body;
            var rules = vrules.complete_profile;
            var message = {
                required: t('required')
            }
            var keywords = {
                'user_full_name': t('rest_keywords_user_full_name'),
                'date_of_birth': t('rest_keywords_user_date_of_birth')
            }

            const isValid = await validator.checkValidationRules(req, res, request_data, rules, message, keywords);
            console.log(isValid);
            if (!isValid) return;

            userModel.complete_profile(request_data, request_data.user_id, (_response_data)=>{
                console.log("User model response:", _response_data);
                common.response(res, _response_data);
            });

        } catch(error){
            console.error("Error in complete_profile:", error);
            return common.response(res, {
                code: response_code.OPERATION_FAILED,
                message: t('rest_keywords_something_went_wrong')
            });
        }
        
    }

    async trending_posts(req,res){
        var request_data = req.body;
        userModel.trending_posts(request_data, (_response_data)=>{
            common.response(res, _response_data);
        });
    }

    async add_post(req,res){
        try{
            var request_data = req.body;

            var rules = vrules.add_post;

            var message = {
                required: t('required')
            }
            var keywords = {
                'descriptions': t('rest_keywords_descriptions'),
                'expire_timer': t('rest_keywords_expire_timer'),
                'post_type': t('rest_keywords_post_type'),
                'category_id': t('rest_keywords_category_id'),
                'user_id': t('rest_keywords_user_id'),
                'media_names': t('rest_keywords_media_names')
            }

            const isValid = await validator.checkValidationRules(req, res, request_data, rules, message, keywords);
            if (!isValid) return;

            userModel.add_post(request_data, (_response_data)=>{
                common.response(res, _response_data);
            });

        } catch(error){
            console.error(error);
            return common.response(res, {
                code: response_code.OPERATION_FAILED,
                message: t('rest_keywords_something_went_wrong')
            });
        }
        
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

    async save_post(req,res){
        var request_data = req.body;
        userModel.save_post(request_data, request_data.user_id, (_response_data)=>{
            common.response(res, _response_data);
        });
    }

    async show_saved_post(req,res){
        var request_data = req.body;
        userModel.show_saved_post(request_data, request_data.user_id, (_response_data)=>{
            common.response(res, _response_data);
        });
    }

    async add_comment(req,res){
        var request_data = req.body;
        userModel.add_comment(request_data, request_data.user_id, (_response_data)=>{
            common.response(res, _response_data);
        });
    }

    async show_post_comments(req,res){
        var request_data = req.body;
        userModel.show_post_comments(request_data, (_response_data)=>{
            common.response(res, _response_data);
        });
    }

    async delete_posts(req,res){
        var request_data = req.body;
        userModel.delete_posts(request_data, (_response_data)=>{
            common.response(res, _response_data);
        });
    }

    async change_pswd(req,res){
        try{
            var request_data = req.body;

            var rules = vrules.change_pswd;

            var message = {
                required: t('required'),
                'old_password.min': t('passwords_min'),
                'new_password.min': t('passwords_min')
            }
            var keywords = {
                'new_password': t('rest_keywords_password'),
                'old_password': t('rest_keywords_password')
            }

            const isValid = await validator.checkValidationRules(req, res, request_data, rules, message, keywords);
            if (!isValid) return;

            userModel.change_pswd(request_data, (_response_data)=>{
                common.response(res, _response_data);
            });

        } catch(error){
            return common.response(res, {
                code: response_code.OPERATION_FAILED,
                message: t('rest_keywords_something_went_wrong')
            });
        }
        
    }

    async edit_profile(req,res){
        var request_data = req.body;
        userModel.edit_profile(request_data, request_data.user_id, (_response_data)=>{
            common.response(res, _response_data);
        });
    }

    async contact_us(req,res){
        try{
            var request_data = req.body;

            var rules = vrules.contact_us;

            var message = {
                required: t('required'),
                email: t('email')
            }
            var keywords = {
                'email_id': t('rest_keywords_email_id')
            }

            const isValid = await validator.checkValidationRules(req, res, request_data, rules, message, keywords);
            if (!isValid) return;

            userModel.contact_us(request_data, (_response_data)=>{
                common.response(res, _response_data);
            });

        } catch(error){
            return common.response(res, {
                code: response_code.OPERATION_FAILED,
                message: t('rest_keywords_something_went_wrong')
            });
        }
    }

    async report_post(req,res){
        var request_data = req.body;
        userModel.report_post(request_data, request_data.user_id, (_response_data)=>{
            common.response(res, _response_data);
        });
    }

    async report_profile(req,res){
        var request_data = req.body;
        userModel.report_profile(request_data, request_data.user_id, (_response_data)=>{
            common.response(res, _response_data);
        });
    }

    async list_categories(req,res){
        var request_data = req.body;
        userModel.list_categories(request_data, (_response_data)=>{
            common.response(res, _response_data);
        });
    }
    
    async filter_post_category(req,res){
        var request_data = req.body;
        userModel.filter_post_category(request_data, (_response_data)=>{
            common.response(res, _response_data);
        });
    }
}

module.exports = new User();