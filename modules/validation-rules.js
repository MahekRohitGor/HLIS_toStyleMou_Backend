const vrules = {
    signup:{
        email_id: "required|email",
        user_name: "required",
        code_id: "required",
        mobile_number: "string|min:10|max:10|regex:/^[0-9]+$/",
        passwords: "required|min:8"
    },
    login:{
        email_id: "required|email",
        passwords: "required|min:8"
    },
    forgot_password:{
        email_id: "required|email"
    },
    reset_password:{
        email_id: "required|email",
        reset_token: "required|min:10",
        new_password: "required|min:8"
    },
    complete_profile:{
        user_full_name: "required",
        date_of_birth: "required"
    },
    add_post:{
        descriptions: "required",
        expire_timer: "required",
        post_type: "required",
        category_id: "required",
        user_id: "required",
        media_names: "required"
    },
    change_pswd:{
        user_id: "required",
        old_password: "required|min:8",
        new_password: "required|min:8"
    },
    contact_us:{
        email_id: "required|email"
    }
}

module.exports = vrules;