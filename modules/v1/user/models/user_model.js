const common = require("../../../../utilities/common");
const database = require("../../../../config/database");
const response_code = require("../../../../utilities/response-error-code");
const md5 = require("md5");
const {default: localizify} = require('localizify');
const { t } = require('localizify');


class userModel {
    async signup(request_data, callback) {
        try {
            const data = {
                user_name: request_data.user_name,
                email_id: request_data.email_id,
                code_id: request_data.code_id,
                mobile_number: request_data.mobile_number,
                passwords: md5(request_data.passwords)
            };
    
            const device_data = {
                device_type: request_data.device_type,
                device_token: request_data.device_token,
                os_version: request_data.os_version,
                app_version: request_data.app_version,
                time_zone: request_data.time_zone
            };
    
            const checkUserExistsQuery = "SELECT * FROM tbl_user WHERE email_id = ?";
            const [existingUsers] = await database.query(checkUserExistsQuery, [data.email_id]);
    
            if (existingUsers.length > 0) {
                const user_data_ = existingUsers[0];
    
                if (existingUsers.length > 1) {
                    await database.query(
                        "UPDATE tbl_user SET is_deleted = 1 WHERE user_id = ?",
                        [existingUsers[1].user_id]
                    );
                }
    
                const otp_obj = request_data.otp ? { otp: request_data.otp } : {};
    
                common.updateUserInfo(user_data_.user_id, otp_obj, (error, updateUser) => {
                    if (error) {
                        console.log(error);
                        return callback({
                            code: response_code.OPERATION_FAILED,
                            message: t('signup_error', { username: request_data.user_name })
                        });
                    }
                    return callback({
                        code: response_code.SUCCESS,
                        message: t('rest_keywords_success'),
                        data: updateUser
                    });
                });
    
            } else {
                const [insertResult] = await database.query("INSERT INTO tbl_user SET ?", data);
                const userId = insertResult.insertId;
                await this.enterOtp(userId);
    
                await database.query(
                    "INSERT INTO tbl_device_info (device_type, time_zone, device_token, os_version, app_version, user_id) VALUES (?, ?, ?, ?, ?, ?)",
                    [device_data.device_type, device_data.time_zone, device_data.device_token, device_data.os_version, device_data.app_version, userId]
                );
    
                common.getUserDetail(userId, userId, async (err, userInfo) => {
                    try {
                        if (err) {
                            return callback({
                                code: response_code.OPERATION_FAILED,
                                message: t('rest_keywords_something_went_wrong', { username: request_data.user_name })
                            });
                        }
    
                        if (userInfo.is_profile_completed === 1) {
                            const userToken = common.generateToken(40);
                            const deviceToken = common.generateToken(40);
    
                            await Promise.all([
                                database.query("UPDATE tbl_user SET token = ? WHERE user_id = ?", [userToken, userId]),
                                database.query("UPDATE tbl_device_info SET device_token = ? WHERE user_id = ?", [deviceToken, userId])
                            ]);
    
                            userInfo.token = userToken;
                            userInfo.device_token = deviceToken;
    
                            return callback({
                                code: response_code.SUCCESS,
                                message: t('rest_keywords_success') + "... " + 
                                         t('verification_pending'),
                                data: userInfo
                            });
                        } else {
                            return callback({
                                code: response_code.SUCCESS,
                                message: t('rest_keywords_success') + "... " + 
                                         t('verification_profile_pending'),
                                data: userInfo
                            });
                        }
                    } catch (tokenError) {
                        return callback({
                            code: response_code.OPERATION_FAILED,
                            message: t('rest_keywords_something_went_wrong', { username: request_data.user_name })
                        });
                    }
                });
            }
    
        } catch (error) {
            return callback({
                code: response_code.OPERATION_FAILED,
                message: t('rest_keywords_something_went_wrong', { username: request_data.user_name })
            });
        }
    }    

    async enterOtp(user_id){
        const otp = common.generateOtp(4);
        const insertOtpQuery = "INSERT INTO tbl_otp (user_id, otp) VALUES (?, ?)";
        await database.query(insertOtpQuery, [user_id, otp]);
        console.log("OTP sent to user_id:", user_id, "OTP:", otp);
    }

    // async verify(request_data, callback){
    //     const { user_id, otp } = request_data;
    //     var verifyOtpQuery = "UPDATE tbl_user u INNER JOIN tbl_otp o ON u.user_id = o.user_id SET u.is_verify = 1 WHERE u.user_id = ? AND o.otp = ?";
    //     try {
    //         const [result] = await database.query(verifyOtpQuery, [user_id, otp]);
    //         if (result.affectedRows > 0) {
    //             return callback({
    //                 code: response_code.SUCCESS,
    //                 message: "User verified successfully"
    //             });
    //         } else {
    //             return callback({
    //                 code: response_code.NOT_FOUND,
    //                 message: "Invalid OTP or user not found"
    //             });
    //         }
    //     } catch (error) {
    //         return callback({
    //             code: response_code.OPERATION_FAILED,
    //             message: error.sqlMessage || "Error verifying OTP"
    //         });
    //     }
    // }

    async login(request_data, callback){
        localizify.setLocale(request_data.userLang);
        console.log(request_data.userLang);
        const user_data = {};
        if(request_data.email_id != undefined && request_data.email_id != ""){
            user_data.email_id = request_data.email_id;
        }
        if(request_data.mobile_number != undefined && request_data.mobile_number != ""){
            user_data.mobile_number = request_data.mobile_number;
        }
        if(request_data.passwords != undefined){
            user_data.passwords = md5(request_data.passwords);
        }

        var selectUserWithCred = "SELECT * FROM tbl_user WHERE (email_id = ? AND passwords = ?) or (mobile_number = ? and passwords = ?)";
        var params = [user_data.email_id, user_data.passwords, user_data.mobile_number, user_data.passwords];

        try{
            const [status] = await database.query(selectUserWithCred, params);

            if (status.length === 0) {
                return callback({
                    code: response_code.NOT_FOUND,
                    message: t('no_data_found')
                });
            }

            const user_id = status[0].user_id;

            const token = common.generateToken(40);
            const updateTokenQuery = "UPDATE tbl_user SET token = ?, is_login = 1 WHERE user_id = ?";
            await database.query(updateTokenQuery, [token, user_id]);

            const device_token = common.generateToken(40);
            const updateDeviceToken = "UPDATE tbl_device_info SET device_token = ? WHERE user_id = ?";
            await database.query(updateDeviceToken, [device_token, user_id]);

            common.getUserDetailLogin(user_id, (err, userInfo)=>{
                // console.log("getUserDetailLogin callback:", err, userInfo);
                if(err){
                    console.log("Error here", err);
                    return callback({
                        code: response_code.OPERATION_FAILED,
                        message: t('no_data_found')
                    });
                }
                else{
                    userInfo.token = token;
                    userInfo.device_token = device_token;
                    return callback({
                        code: response_code.SUCCESS,
                        message: t('login_success'),
                        data: userInfo
                    });

                }
            });

        } catch(error){
            return callback({
                code: response_code.OPERATION_FAILED,
                message: error.sqlMessage || t('login_error')
            });
        }
    }

    async logout(request_data, callback){
        localizify.setLocale(request_data.userLang);
        console.log("Language in logout function:", request_data.userLang);
        try{
            const user_id = request_data.user_id;
            var select_user_query = "SELECT * FROM tbl_user WHERE user_id = ? and is_login = 1";
            const [info] = await database.query(select_user_query, [user_id]);
            if(info.length > 0){
                const updateDeviceTokenQuery = "UPDATE tbl_device_info SET device_token = '', updated_at = NOW() WHERE user_id = ?";
            const updateTokenQuery = "UPDATE tbl_user SET token = '', is_login = 0 WHERE user_id = ?";
    
            await Promise.all([
                database.query(updateDeviceTokenQuery, [user_id]),
                database.query(updateTokenQuery, [user_id])
            ]);
    
            const getUserQuery = "SELECT user_id, user_name, email_id FROM tbl_user WHERE user_id = ?";
            const [updatedUser] = await database.query(getUserQuery, [user_id]);
    
            return callback({
                code: response_code.SUCCESS,
                message: t('logout_success'),
                data: updatedUser[0]
            });

            } else{
                return callback({
                    code: response_code.NOT_FOUND,
                    message: t('user_not_found_or_logged_out')
                });
            }

        } catch(error){
            return callback({
                code: response_code.OPERATION_FAILED,
                message: t('some_error_occurred'),
                data: error
            })
        }

    }

    async forgot_password(requested_data, callback) {
        localizify.setLocale(requested_data.userLang);
        const { email_id } = requested_data;
        
        try {
            const userQuery = "SELECT * FROM tbl_user WHERE email_id = ?";
            const [user] = await database.query(userQuery, [email_id]);
            
            if (!user.length) {
                return callback({
                    code: response_code.NOT_FOUND,
                    message: t('user_not_found')
                });
            }
            
            const reset_token = common.generateToken(10);
            const expires_at = new Date(Date.now() + 3600000);
            
            const insertTokenQuery = `INSERT INTO tbl_forgot_password (email_id, reset_token, expires_at) VALUES (?, ?, ?)`;
            await database.query(insertTokenQuery, [email_id, reset_token, expires_at]);
            
            return callback({
                code: response_code.SUCCESS,
                message: t('password_reset_token_sent')
            });
            
        } catch (error) {
            return callback({
                code: response_code.OPERATION_FAILED,
                message: error.sqlMessage || t('forgot_password_error')
            });
        }
    }

    async reset_password(requested_data, callback) {
        localizify.setLocale(requested_data.userLang);
        const { reset_token, new_password } = requested_data;
    
        try {
            const selectTokenQuery = `
                SELECT email_id FROM tbl_forgot_password 
                WHERE reset_token = ? AND is_active = 1 AND expires_at > NOW()
            `;
    
            const [result] = await database.query(selectTokenQuery, [reset_token]);
    
            if (!result.length) {
                return callback({
                    code: response_code.NOT_FOUND,
                    message: t('invalid_expired_reset_token')
                });
            }
    
            const email_id = result[0].email_id;
            const hashedPassword = md5(new_password);
    
            const updatePasswordQuery = "UPDATE tbl_user SET passwords = ? WHERE email_id = ?";
            await database.query(updatePasswordQuery, [hashedPassword, email_id]);
    
            const deactivateTokenQuery = "UPDATE tbl_forgot_password SET is_active = 0 WHERE reset_token = ?";
            await database.query(deactivateTokenQuery, [reset_token]);
    
            return callback({
                code: response_code.SUCCESS,
                message: t('password_reset_success')
            });
    
        } catch (error) {
            return callback({
                code: response_code.OPERATION_FAILED,
                message: error.sqlMessage || t('password_reset_error')
            });
        }
    }

    async complete_profile(requested_data, user_id, callback) {
        localizify.setLocale(requested_data.userLang);
        try {
            const userFetchQuery = "SELECT is_profile_completed FROM tbl_user WHERE user_id = ?";
            const [result] = await database.query(userFetchQuery, [user_id]);

            if (result[0].is_profile_completed === 1) {
                return callback({
                    code: response_code.SUCCESS,
                    message: t('profile_already_completed'),
                });
            } else{

                const { user_full_name, date_of_birth } = requested_data;
    
                if (result.length === 0) {
                    return callback({
                        code: response_code.NOT_FOUND,
                        message: t('user_not_found'),
                    });
                }

            const updateProfileQuery = `
                UPDATE tbl_user 
                SET user_full_name = ?, date_of_birth = ?, is_profile_completed = 1
                WHERE user_id = ?`;
            
            await database.query(updateProfileQuery, [user_full_name, date_of_birth, user_id]);
    
            const fetchUpdatedUserQuery = "SELECT * FROM tbl_user WHERE user_id = ?";
            const [updatedUser] = await database.query(fetchUpdatedUserQuery, [user_id]);
    
            return callback({
                code: response_code.SUCCESS,
                message: t('profile_completed'),
                data: updatedUser[0],
            });

            }
    
        } catch (error) {
            return callback({
                code: response_code.OPERATION_FAILED,
                message: error.sqlMessage || t('profile_update_error'),
            });
        }
    }

    async add_post(request_data, callback) {
        try {
            const { descriptions, expire_timer, post_type, category_id, user_id, media_names, tags } = request_data;
    
            const mediaInsertQuery = "INSERT INTO tbl_image (image_name) VALUES ?";
            const mediaValues = media_names.map(name => [name]);
            const [mediaResult] = await database.query(mediaInsertQuery, [mediaValues]);
    
            const media_ids = [];
            for (let i = 0; i < media_names.length; i++) {
                media_ids.push(mediaResult.insertId + i);
            }
    
            const postInsertQuery = `
                INSERT INTO tbl_post (descriptions, expire_timer, share_cnt, avg_rating, post_type, category_id, user_id)
                VALUES (?, ?, 0, 0, ?, ?, ?)`;
            const [postResult] = await database.query(postInsertQuery, [descriptions, expire_timer, post_type, category_id, user_id]);
    
            const post_id = postResult.insertId;
    
            const postMediaRelationQuery = "INSERT INTO tbl_post_image_relation (post_id, image_id) VALUES ?";
            const postMediaValues = media_ids.map(media_id => [post_id, media_id]);
            await database.query(postMediaRelationQuery, [postMediaValues]);
    
            if (post_type === "toStyleCompare") {
                const subPostInsertQuery = `
                    INSERT INTO tbl_sub_post (post_id, image_id, avg_rating)
                    VALUES ?`;
                const subPostValues = media_ids.map(img_id => [post_id, img_id, 0.0]);
                await database.query(subPostInsertQuery, [subPostValues]);
            }
    
            if (tags && tags.length > 0) {
                for (let tag of tags) {
                    let tag_id;
    
                    const [existingTag] = await database.query("SELECT tag_id FROM tbl_tags WHERE tags = ?", [tag]);
    
                    if (existingTag.length > 0) {
                        tag_id = existingTag[0].tag_id;
                        await database.query("UPDATE tbl_tags SET tags_cnt = tags_cnt + 1 WHERE tag_id = ?", [tag_id]);
                    } else {
                        const [newTag] = await database.query("INSERT INTO tbl_tags (tags, tags_cnt) VALUES (?, 1)", [tag]);
                        tag_id = newTag.insertId;
                    }
    
                    await database.query("INSERT INTO tbl_post_tag (post_id, tag_id) VALUES (?, ?)", [post_id, tag_id]);
                }
            }
    
            const fetchPostQuery = `
                SELECT p.post_id, p.descriptions, p.expire_timer, p.post_type, p.category_id, p.user_id,
                       GROUP_CONCAT(i.image_name) AS media_files,
                       GROUP_CONCAT(t.tags) AS tags
                FROM tbl_post p
                LEFT JOIN tbl_post_image_relation pi ON pi.post_id = p.post_id
                LEFT JOIN tbl_image i ON i.image_id = pi.image_id
                LEFT JOIN tbl_post_tag pt ON pt.post_id = p.post_id
                LEFT JOIN tbl_tags t ON t.tag_id = pt.tag_id
                WHERE p.post_id = ?
                GROUP BY p.post_id
            `;
            const [createdPost] = await database.query(fetchPostQuery, [post_id]);
    
            return callback({
                code: response_code.SUCCESS,
                message: t('post_added_success'),
                data: createdPost[0],
            });
    
        } catch (error) {
            return callback({
                code: response_code.OPERATION_FAILED,
                message: error.sqlMessage || t('post_add_error'),
            });
        }
    }

    async get_post_ranks(request_data, user_id, callback) {
        try {
            const { post_id } = request_data;

            const postOwnerQuery = `SELECT p.user_id, p.expire_timer FROM tbl_post p inner join tbl_user u on u.user_id = p.user_id WHERE p.post_id = ? and u.is_login = 1`;
            const [postDetails] = await database.query(postOwnerQuery, [post_id]);

            if (postDetails.length === 0) {
                return callback({
                    code: response_code.NOT_FOUND,
                    message: t('post_not_found_or_login_required')
                });
            }
    
            const { user_id: owner_id, expire_timer } = postDetails[0];
            const isExpired = new Date() > new Date(expire_timer);
            if (user_id && user_id === owner_id && isExpired) {
                const rankQuery = `
                SELECT 
                    sp.image_id,
                    sp.avg_rating,
                    RANK() OVER (ORDER BY sp.avg_rating DESC) AS rank_no
                FROM tbl_sub_post sp
                INNER JOIN tbl_post p ON p.post_id = sp.post_id
                WHERE sp.post_id = ? AND NOW() > p.expire_timer
            `;
    
            const [rankResults] = await database.query(rankQuery, [post_id]);
            
            return callback({
                code: response_code.SUCCESS,
                message: t('rankings_fetched_success'),
                data: rankResults
            });

            } else{
                const normalPostQuery = `
                SELECT 
                    p.post_id,
                    p.descriptions,
                    p.expire_timer,
                    p.share_cnt,
                    p.avg_rating,
                    p.post_type,
                    i.image_name
                FROM tbl_post p
                LEFT JOIN tbl_post_image_relation pi ON pi.post_id = p.post_id
                LEFT JOIN tbl_image i ON i.image_id = pi.image_id
                WHERE p.post_id = ?
            `;

            const [normalPost] = await database.query(normalPostQuery, [post_id]);

            return callback({
                code: response_code.SUCCESS,
                message: t('post_details_fetched_success'),
                data: normalPost
            });
            }
    
        } catch (error) {
            return callback({
                code: response_code.OPERATION_FAILED,
                message: error.sqlMessage || t('rankings_fetch_error')
            });
        }
    }

    async trending_posts(request_data, callback) {
        try {
            const updateTrendingQuery = `
                UPDATE tbl_post p
                JOIN (
                    SELECT post_id
                    FROM (
                        SELECT post_id, COUNT(rating_id) AS total_ratings, AVG(rating) AS avg_rating
                        FROM tbl_rating
                        GROUP BY post_id
                        ORDER BY total_ratings DESC, avg_rating DESC
                        LIMIT 3
                    ) AS trending_post
                ) tp ON p.post_id = tp.post_id
                SET p.is_trending = 1
                WHERE is_active = 1 AND is_deleted = 0
            `;
    
            await database.query(updateTrendingQuery);
    
            const resetTrendingQuery = `
                UPDATE tbl_post 
                SET is_trending = 0 
                WHERE post_id NOT IN (
                    SELECT post_id FROM (
                        SELECT post_id
                        FROM tbl_rating
                        GROUP BY post_id
                        ORDER BY COUNT(rating_id) DESC, AVG(rating) DESC
                        LIMIT 3
                    ) AS trending
                )
            `;
    
            await database.query(resetTrendingQuery);
    
            const fetchTrendingPostsQuery = `
                SELECT p.post_id, i.image_name
                FROM tbl_post p
                LEFT JOIN tbl_post_image_relation pi ON pi.post_id = p.post_id
                LEFT JOIN tbl_image i ON i.image_id = pi.image_id
                WHERE p.is_trending = 1 AND p.is_active = 1 AND p.is_deleted = 0
            `;
    
            const [trendingPosts] = await database.query(fetchTrendingPostsQuery);
    
            return callback({
                code: response_code.SUCCESS,
                message: t('trending_posts_fetched_success'),
                data: trendingPosts
            });
    
        } catch (error) {
            return callback({
                code: response_code.OPERATION_FAILED,
                message: error.sqlMessage || t('trending_posts_fetch_error')
            });
        }
    }
    
    async get_notifications(request_data, user_id, callback) {
        try {
            const selectUserQuery = "SELECT user_id FROM tbl_user WHERE is_login = 1 AND user_id = ?";
            const [userResult] = await database.query(selectUserQuery, [user_id]);
    
            if (userResult.length === 0) {
                return callback({
                    code: response_code.OPERATION_FAILED,
                    message: t('login_required_or_user_not_found'),
                });
            }
    
            const getNotificationQuery = `
                SELECT cover_image, title, descriptions 
                FROM tbl_notification 
                WHERE user_id = ? 
                ORDER BY created_at DESC;
            `;
            const [notifications] = await database.query(getNotificationQuery, [user_id]);
    
            return callback({
                code: response_code.SUCCESS,
                message: notifications.length > 0 ? t('notifications_list') : t('no_notifications'),
                data: notifications,
            });
    
        } catch (error) {
            console.error("Error fetching notifications:", error);
            return callback({
                code: response_code.OPERATION_FAILED,
                message: t('notifications_fetch_error'),
                error: error.message
            });
        }
    }

    async follow_user(request_data, user_id, callback) {
        try {
            const { follow_id } = request_data;

    
            const checkFollowQuery = "SELECT * FROM tbl_follow WHERE user_id = ? AND follow_id = ?";
            const [existingFollow] = await database.query(checkFollowQuery, [user_id, follow_id]);
    
            if (existingFollow.length > 0) {
                return callback({
                    code: response_code.ALREADY_EXISTS,
                    message: t('already_following_user'),
                });
            }
    
            const followQuery = "INSERT INTO tbl_follow (user_id, follow_id) VALUES (?, ?)";
            await database.query(followQuery, [user_id, follow_id]);
    
            return callback({
                code: response_code.SUCCESS,
                message: t('user_followed_success'),
            });
    
        } catch (error) {
            return callback({
                code: response_code.OPERATION_FAILED,
                message: t('user_follow_error'),
                data: error.message || error,
            });
        }
    }
    
    async rate_post(request_data, user_id, callback) {
        try {
            const { post_id, rating, sub_post_id } = request_data;
    
            if (!post_id || !rating || rating < 1 || rating > 5) {
                return callback({
                    code: response_code.BAD_REQUEST,
                    message: "Invalid post_id or rating (must be between 1-5)",
                });
            }
    
            const fetchPostTypeQuery = "SELECT post_type FROM tbl_post WHERE post_id = ?";
            const [post] = await database.query(fetchPostTypeQuery, [post_id]);
    
            if (post.length === 0) {
                return callback({
                    code: response_code.NOT_FOUND,
                    message: t('post_not_found'),
                });
            }
    
            const post_type = post[0].post_type;
    
            if (post_type === "toStyleCompare") {
                if (!sub_post_id) {
                    return callback({
                        code: response_code.BAD_REQUEST,
                        message: t('sub_post_id_required'),
                    });
                }
    
                const checkSubpostQuery = "SELECT * FROM tbl_sub_post WHERE sub_post_id = ?";
                const [subpost] = await database.query(checkSubpostQuery, [sub_post_id]);
    
                if (subpost.length === 0) {
                    return callback({
                        code: response_code.NOT_FOUND,
                        message: t('sub_post_not_found'),
                    });
                }
                const checkRatingQuery = "SELECT * FROM tbl_sub_post_rating WHERE sub_post_id = ? AND user_id = ?";
                const [existingRating] = await database.query(checkRatingQuery, [sub_post_id, user_id]);
    
                if (existingRating.length > 0) {
                
                    const updateQuery = "UPDATE tbl_sub_post_rating SET rating = ?, updated_at = NOW() WHERE sub_post_id = ? AND user_id = ?";
                    await database.query(updateQuery, [rating, sub_post_id, user_id]);
                } else {
                    const insertQuery = "INSERT INTO tbl_sub_post_rating (sub_post_id, user_id, rating) VALUES (?, ?, ?)";
                    await database.query(insertQuery, [sub_post_id, user_id, rating]);
                }
    
            } else {
                const checkRatingQuery = "SELECT * FROM tbl_rating WHERE post_id = ? AND user_id = ?";
                const [existingRating] = await database.query(checkRatingQuery, [post_id, user_id]);
    
                if (existingRating.length > 0) {
                    const updateQuery = "UPDATE tbl_rating SET rating = ?, updated_at = NOW() WHERE post_id = ? AND user_id = ?";
                    await database.query(updateQuery, [rating, post_id, user_id]);
                } else {
                    const insertQuery = "INSERT INTO tbl_rating (post_id, user_id, rating) VALUES (?, ?, ?)";
                    await database.query(insertQuery, [post_id, user_id, rating]);
                }
            }
    
            return callback({
                code: response_code.SUCCESS,
                message: t('rating_added_success', { post_type: post_type }),
            });
    
        } catch (error) {
            return callback({
                code: response_code.OPERATION_FAILED,
                message: error.sqlMessage || t('rating_add_error'),
            });
        }
    }

    async get_profile(request_data, user_id, callback){
        try{
            var getUserQuery = `select u.user_name, 
                            u.user_full_name, 
                            u.descriptions, 
                            u.profile_pic, 
                            u.follower_cnt, 
                            u.following_cnt, 
                            u.rating_cnt, 
                            i.image_name
                            from tbl_user as u 
                            left join tbl_post as p 
                            on u.user_id = p.user_id 
                            left join tbl_sub_post as sp 
                            on sp.post_id = p.post_id
                            left join tbl_image as i 
                            on i.image_id = sp.image_id
                            where u.user_id = ? and u.is_login = 1 and u.is_active = 1 and u.is_deleted = 0`;

            const [results] = await database.query(getUserQuery, [user_id]);
            if(results.length === 0){
                return callback({
                    code: response_code.OPERATION_FAILED,
                    message: t('user_not_found')
                });
            }
            return callback({
                code: response_code.SUCCESS,
                message: t('user_profile'),
                data: results
            });
        } catch(error){
            return callback({
                code: response_code.OPERATION_FAILED,
                message: error
            });
        }   
    }

    async get_other_profile(request_data, user_id, callback){
        try{
            var getUserQuery = `select u.user_name, 
                            u.user_full_name, 
                            u.descriptions, 
                            u.profile_pic, 
                            u.follower_cnt, 
                            u.following_cnt, 
                            u.rating_cnt, 
                            i.image_name
                            from tbl_user as u 
                            left join tbl_post as p 
                            on u.user_id = p.user_id 
                            left join tbl_sub_post as sp 
                            on sp.post_id = p.post_id
                            left join tbl_image as i 
                            on i.image_id = sp.image_id
                            where u.user_id = ? and u.is_active = 1 and u.is_deleted = 0`;

            const [results] = await database.query(getUserQuery, [user_id]);
            if(results.length === 0){
                return callback({
                    code: response_code.OPERATION_FAILED,
                    message: t('user_not_found')
                });
            }
            return callback({
                code: response_code.SUCCESS,
                message: t('user_profile'),
                data: results
            });

        }catch(error){
            return callback({
                code: response_code.OPERATION_FAILED,
                message: error
            });
        }
    }
    
    async filter(request_data, callback){
        const {filter_type, post_type} = request_data;
        if(filter_type === "new"){
            var query;
            var queryParams = [];

            if(post_type === "toStyleAll"){
                query = `select
                        p.post_id,
                        i.image_name,
                        p.post_type
                        from tbl_post p
                        left join
                        tbl_post_image_relation pi
                        on pi.post_id = p.post_id
                        left join
                        tbl_image i
                        on i.image_id = pi.image_id
                        where p.is_active = 1 and p.is_deleted = 0 and i.is_active = 1 and i.is_deleted = 0
                        order by p.created_at limit 6;`;
            } else{
                query = `select
                        p.post_id,
                        i.image_name,
                        p.post_type
                        from tbl_post p
                        left join
                        tbl_post_image_relation pi
                        on pi.post_id = p.post_id
                        left join
                        tbl_image i
                        on i.image_id = pi.image_id
                        where p.is_active = 1 and p.is_deleted = 0 and i.is_active = 1 and i.is_deleted = 0
                        and p.post_type = ?
                        order by p.created_at limit 3;`;
                        queryParams.push(post_type);
            }

            const [results] = await database.query(query, queryParams);
            if(results.length === 0){
                return callback({
                    code: response_code.NOT_FOUND,
                    message: t('no_data_found')
                });
            }
            return callback({
                code: response_code.SUCCESS,
                message: t('posts_list'),
                data: results
            });

        } else if(filter_type === "following"){
            var query;
            var queryParams = [];

            if(post_type === "toStyleAll"){
                query = `select
                        p.post_id,
                        i.image_name,
                        p.post_type
                        from tbl_post p
                        left join
                        tbl_post_image_relation pi
                        on pi.post_id = p.post_id
                        left join
                        tbl_image i
                        on i.image_id = pi.image_id
                        where p.is_active = 1 and p.is_deleted = 0 and i.is_active = 1 and i.is_deleted = 0
                        and
                        p.user_id in (
                            select f.follow_id from tbl_follow f where f.user_id = 1
                        )
                        order by p.created_at limit 3;`;
            } else{
                query = `select
                        p.post_id,
                        i.image_name,
                        p.post_type
                        from tbl_post p
                        left join
                        tbl_post_image_relation pi
                        on pi.post_id = p.post_id
                        left join
                        tbl_image i
                        on i.image_id = pi.image_id
                        where p.is_active = 1 and p.is_deleted = 0 and i.is_active = 1 and i.is_deleted = 0
                        and
                        p.user_id in (
                            select f.follow_id from tbl_follow f where f.user_id = 1
                        )
                        and post_type = ?
                        order by p.created_at limit 3;
                        `;
                        queryParams.push(post_type);
            }

            const [results] = await database.query(query, queryParams);
            if(results.length === 0){
                return callback({
                    code: response_code.NOT_FOUND,
                    message: t('no_data_found')
                });
            }
            return callback({
                code: response_code.SUCCESS,
                message: t('posts_list'),
                data: results
            });

        } else if(filter_type === "expiring"){
            var query;
            var queryParams = [];

            if(post_type === "toStyleAll"){
                query = `select
                        p.post_id,
                        i.image_name,
                        p.post_type
                        from tbl_post p
                        left join
                        tbl_post_image_relation pi
                        on pi.post_id = p.post_id
                        left join
                        tbl_image i
                        on i.image_id = pi.image_id
                        where p.is_active = 1 and p.is_deleted = 0 and i.is_active = 1 and i.is_deleted = 0
                        and
                        expire_timer BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 1 YEAR)`;

            } else{
                query = `select
                        p.post_id,
                        i.image_name,
                        p.post_type
                        from tbl_post p
                        left join
                        tbl_post_image_relation pi
                        on pi.post_id = p.post_id
                        left join
                        tbl_image i
                        on i.image_id = pi.image_id
                        where p.is_active = 1 and p.is_deleted = 0 and i.is_active = 1 and i.is_deleted = 0
                        and
                        expire_timer BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 1 YEAR)
                        and post_type = ?;
                        `;
                        queryParams.push(post_type);
            }

            const [results] = await database.query(query, queryParams);
            if(results.length === 0){
                return callback({
                    code: response_code.NOT_FOUND,
                    message: t('no_data_found')
                });
            }
            return callback({
                code: response_code.SUCCESS,
                message: t('posts_list'),
                data: results
            });

        } else{
            return callback({
                code: response_code.NOT_FOUND,
                message: t('some_error_occurred')
            });
        }
    }

    async get_followers(requested_data, user_id ,callback){
        try{

            var getFollowerQuery = `
            SELECT u.user_id, u.user_name, u.user_full_name
            FROM tbl_follow f
            JOIN tbl_user u ON f.user_id = u.user_id
            WHERE f.follow_id = ? AND f.is_active = 1;
            `;

            const [results] = await database.query(getFollowerQuery, [user_id]);
            console.log(results);

            if(results.length === 0){
                return callback({
                    code: response_code.NOT_FOUND,
                    message: t('no_data_found'),
                    data: results
                });

            } else{
                return callback({
                    code: response_code.SUCCESS,
                    message: t('followers_list'),
                    data: results
                });
            }


        } catch(error){
            return callback({
                code: response_code.OPERATION_FAILED,
                message: error
            })
        }
    }

    async get_following(request_data, user_id, callback){
        try{

            var getFollowerQuery = `
            SELECT u.user_id, u.user_name, u.user_full_name
            FROM tbl_follow f
            JOIN tbl_user u ON f.follow_id = u.user_id
            WHERE f.user_id = ? AND f.is_active = 1;
            `;

            const [results] = await database.query(getFollowerQuery, [user_id]);
            console.log(results);

            if(results.length === 0){
                return callback({
                    code: response_code.NOT_FOUND,
                    message: t('no_following_found'),
                    data: results
                });

            } else{
                return callback({
                    code: response_code.SUCCESS,
                    message: t('following_list'),
                    data: results
                });
            }


        } catch(error){
            return callback({
                code: response_code.OPERATION_FAILED,
                message: error
            })
        }

    }

    async save_post(request_data, user_id, callback){
        try{

            const {post_id} = request_data;

            const checkQuery = "SELECT * FROM tbl_save WHERE post_id = ? AND user_id = ?";
            const [existingSave] = await database.query(checkQuery, [post_id, user_id]);

            if (existingSave.length > 0) {
                const deleteQuery = "DELETE FROM tbl_save WHERE post_id = ? AND user_id = ?";
                await database.query(deleteQuery, [post_id, user_id]);

                return callback({
                    code: response_code.SUCCESS,
                    message: t('post_unsaved_success'),
                });
            } else {
                const savePostQuery = "INSERT INTO tbl_save (is_save, post_id, user_id) VALUES (1,?,?)";
                await database.query(savePostQuery, [post_id, user_id]);

                return callback({
                    code: response_code.SUCCESS,
                    message: t('post_saved_success')
                });
            }
            

        } catch(error){
            return callback({
                code: response_code.OPERATION_FAILED,
                message: t('some_error_occurred'),
                data: error
            });
        }
    }

    async show_saved_post(request_data, user_id, callback){
        try{

            var checkUserLogin = "SELECT * FROM tbl_user WHERE user_id = ? and is_login = 1";
            const [user] = await database.query(checkUserLogin, [user_id]);

            if(user.length === 0){
                return callback({
                    code: response_code.OPERATION_FAILED,
                    message: t('login_required')
                });
            } else{
                var selectSavedPostQuery = `
                    select
                    u.user_id,
                    p.post_id,
                    u.profile_pic,
                    u.user_full_name,
                    c.category_name,
                    im.image_name as POST_IMAGE,
                    CONCAT(
                            TIMESTAMPDIFF(DAY, p.created_at, CURRENT_TIMESTAMP()), ' days, ',
                            MOD(TIMESTAMPDIFF(HOUR, p.created_at, CURRENT_TIMESTAMP()), 24), ' hours, ',
                            MOD(TIMESTAMPDIFF(MINUTE, p.created_at, CURRENT_TIMESTAMP()), 60), ' minutes'
                        ) AS time_elapsed,
                        p.descriptions,
                        p.comment_cnt,
                        p.avg_rating,
                        t.tags
                    from
                    tbl_save s
                    inner join
                    tbl_post p
                    on s.post_id = p.post_id
                    inner join
                    tbl_category c
                    on c.category_id = p.category_id
                    inner join
                    tbl_post_image_relation i
                    on i.post_id = p.post_id
                    inner join
                    tbl_image im
                    on im.image_id = i.image_id
                    inner join
                    tbl_user u
                    on u.user_id = s.user_id
                    inner join
                    tbl_post_tag pt
                    on pt.post_id = p.post_id
                    inner join
                    tbl_tags t
                    on t.tag_id = pt.tag_id
                    where s.user_id = ?;
                `;

                const [result] = await database.query(selectSavedPostQuery, [user_id]);

                if(result.length === 0){
                    return callback({
                        code: response_code.OPERATION_FAILED,
                        message: t('no_saved_posts')
                    });
                } else{
                    return callback({
                        code: response_code.SUCCESS,
                        message: t('saved_posts_list'),
                        data: result
                    });
                }
            }

        } catch(error){
            return callback({
                code: response_code.OPERATION_FAILED,
                message: t('some_error_occurred'),
                data: error
            });

        }

    }

    async add_comment(request_data, user_id, callback){
        try{
            var checkUserLogin = "SELECT * FROM tbl_user WHERE user_id = ? and is_login = 1";
            const [user] = await database.query(checkUserLogin, [user_id]);

            if(user.length === 0){
                return callback({
                    code: response_code.OPERATION_FAILED,
                    message: t('login_required')
                });
            } else{
                const {post_id, comments} = request_data;
                const query = "INSERT INTO tbl_comments (comments, user_id, post_id) VALUES (?,?,?)";
                await database.query(query, [comments, user_id, post_id]);

                const selectCommentQuery = "SELECT * from tbl_comments where user_id = ? and post_id = ?";
                const [results] = await database.query(selectCommentQuery, [user_id, post_id]);

                return callback({
                    code: response_code.SUCCESS,
                    message: t('comment_added_success'),
                    data: results
                });

            }

        } catch(error){
            return callback({
                code: response_code.OPERATION_FAILED,
                message: t('some_error_occurred'),
                data: error
            });
        }
    }

    async show_post_comments(request_data, callback){
        try{
            const {post_id} = request_data;
            var showCommentQuery = "SELECT * FROM tbl_comments where post_id = ?";
            const [result] = await database.query(showCommentQuery, [post_id]);

            if(result.length === 0){
                return callback({
                    code: response_code.NOT_FOUND,
                    message: t('no_comments')
                });
            } else{
                return callback({
                    code: response_code.SUCCESS,
                    message: t('comments_list'),
                    data: result
                })
            }

        } catch(error){
            return callback({
                code: response_code.OPERATION_FAILED,
                message: t('some_error_occurred'),
                data: error
            })
        }
    }

    async delete_posts(request_data, callback){
        try{

            const {post_id, user_id} = request_data;
            var checkQuery = "SELECT * FROM tbl_post WHERE post_id = ? AND user_id = ?";
            const [post] = await database.query(checkQuery, [post_id, user_id]);

            if (post.length === 0) {
                return callback({
                    code: response_code.NOT_FOUND,
                    message: t('post_delete_unauthorized')
                });
            }

            if (post[0].is_deleted === 1) {
                return callback({
                    code: response_code.SUCCESS,
                    message: t('post_already_deleted')
                });
            }

            
            const deletePostQuery = "UPDATE tbl_post SET is_deleted = 1, is_active = 0 WHERE post_id = ? AND user_id = ?";
            await database.query(deletePostQuery, [post_id, user_id]);

            const deleteImagesQuery = `
                UPDATE tbl_image 
                SET is_deleted = 1, is_active = 0 
                WHERE image_id IN (
                    SELECT image_id FROM tbl_post_image_relation WHERE post_id = ?
                )
            `;
            await database.query(deleteImagesQuery, [post_id]);

            return callback({
                code: response_code.SUCCESS,
                message: t('post_deleted_success')
            });

        } catch(error){
            return callback({
                code: response_code.OPERATION_FAILED,
                message: t('some_error_occurred'),
                data: error
            })
        }
    }

    async contact_us(request_data, callback){
        try{
            const {full_name, email_id, subjects, descp} = request_data;
            const insertDataQuery = "INSERT INTO tbl_contact_us (full_name, email_id, subjects, descp) values (?,?,?,?)";

            await database.query(insertDataQuery, [full_name, email_id, subjects, descp]);
            return callback({
                code: response_code.SUCCESS,
                message: t('thank_you')
            });

        }catch(error){
            return callback({
                code: response_code.OPERATION_FAILED,
                message: t('some_error_occurred'),
                data: error
            });
        }
    }

    async edit_profile(request_data, user_id, callback){
        try{
    
            const allowedFields = ["user_name", "user_full_name", "date_of_birth", "descriptions", "profile_pic"];
            let updateFields = [];
            let values = [];
    
            for (let key of allowedFields) {
                if (request_data[key] !== undefined) {
                    updateFields.push(`${key} = ?`);
                    values.push(request_data[key]);
                }
            }
    
            if (updateFields.length === 0) {
                return callback({
                    code: response_code.NO_CHANGE,
                    message: t('no_valid_fields_update')
                });
            }

            updateFields.push("updated_at = CURRENT_TIMESTAMP()");
            values.push(user_id);
    
            const updateQuery = `
                UPDATE tbl_user 
                SET ${updateFields.join(", ")}
                WHERE user_id = ? AND is_active = 1 AND is_deleted = 0 and is_login = 1
            `;
    
            const [result] = await database.query(updateQuery, values);
    
            if (result.affectedRows > 0) {
                return callback({
                    code: response_code.SUCCESS,
                    message: t('profile_updated_success')
                });
            } else {
                return callback({
                    code: response_code.NOT_FOUND,
                    message: t('profile_update_no_changes')
                });
            }


        } catch(error){
            return callback({
                code: response_code.OPERATION_FAILED,
                message: t('profile_update_error')
            });
        }
    }

    async change_pswd(request_data, callback){
        const user_id = request_data.user_id
        
        var selectQuery = "SELECT * FROM tbl_user WHERE user_id = ? and is_login = 1";
        
        try {
            const [rows] = await database.query(selectQuery, [user_id]);
            
            if (!rows || rows.length === 0) {
                return callback({
                    code: response_code.NOT_FOUND,
                    message: t('no_data_found')
                });
            }
            const user = rows[0];
    
            const oldPasswordHash = md5(request_data.old_password);
            const newPasswordHash = md5(request_data.new_password);

            if (oldPasswordHash !== user.passwords) {
                return callback({
                    code: response_code.OPERATION_FAILED,
                    message: t('old_password_mismatch')
                });
            }
    
            if (newPasswordHash === user.passwords) {
                return callback({
                    code: response_code.OPERATION_FAILED,
                    message: t('old_new_password_same')
                });
            }
    
            const data = {
                passwords: newPasswordHash
            };

            const updateQuery = "UPDATE tbl_user SET ? where user_id = ?";
            await database.query(updateQuery, [data, user_id]);

            const selectUser = "SELECT user_name, user_full_name, descriptions, follower_cnt, following_cnt FROM tbl_user where user_id = ?"
            const [result] = await database.query(selectUser, [user_id]);

            return callback({
                code: response_code.SUCCESS,
                message: t('password_changed_success'),
                data: result
            })
    
        } catch (error) {
            console.error('Change Password Error:', error);
            return callback({
                code: response_code.OPERATION_FAILED,
                message: error.message || t('password_change_error')
            });
        }
    }

    async report_post(request_data, user_id, callback) {
        try {
            const { post_id } = request_data;
    
            const checkQuery = `SELECT report_p_id FROM report_post WHERE user_id = ? AND post_id = ? AND is_active = 1 AND is_deleted = 0`;
            const [existingReport] = await database.query(checkQuery, [user_id, post_id]);
    
            if (existingReport.length > 0) {
                return callback({
                    code: response_code.ALREADY_EXISTS,
                    message: t('post_already_reported')
                });
            }
    
            const insertQuery = `INSERT INTO report_post (user_id, post_id) VALUES (?, ?)`;
            await database.query(insertQuery, [user_id, post_id]);
    
            return callback({
                code: response_code.SUCCESS,
                message: t('post_reported_success')
            });
    
        } catch (error) {
            return callback({
                code: response_code.OPERATION_FAILED,
                message: t('post_report_error'),
                data: error
            });
        }
    }
    
    async report_profile(request_data, user_id, callback) {
        try {
            const { profile_reported_id } = request_data;
    
            // if (!profile_reported_id) {
            //     return callback({
            //         code: response_code.BAD_REQUEST,
            //         message: "Profile ID to report is required"
            //     });
            // }
    
            if (user_id === profile_reported_id) {
                return callback({
                    code: response_code.BAD_REQUEST,
                    message: t('cannot_report_own_profile')
                });
            }
    
            const checkQuery = `SELECT report_p_id FROM report_profile WHERE user_id = ? AND profile_reported_id = ? AND is_active = 1 AND is_deleted = 0`;
            const [existingReport] = await database.query(checkQuery, [user_id, profile_reported_id]);
    
            if (existingReport.length > 0) {
                return callback({
                    code: response_code.ALREADY_EXISTS,
                    message: t('profile_already_reported')
                });
            }
    
            const insertQuery = `INSERT INTO report_profile (user_id, profile_reported_id) VALUES (?, ?)`;
            await database.query(insertQuery, [user_id, profile_reported_id]);
    
            return callback({
                code: response_code.SUCCESS,
                message: t('profile_reported_success')
            });
    
        } catch (error) {
            return callback({
                code: response_code.OPERATION_FAILED,
                message: t('profile_report_error'),
                data: error
            });
        }
    }
    
    async list_categories(request_data, callback){
        try{
            var selectCategoryQuery = `SELECT category_name from tbl_category`;
            const [categories] = await database.query(selectCategoryQuery);
            
            return callback({
                code: response_code.SUCCESS,
                message: t('categories'),
                data: categories
            });

        } catch(error){
            return callback({
                code: response_code.OPERATION_FAILED,
                message: t('some_error_occurred'),
                data: error
            })
        }
    }
    
    async filter_post_category(request_data, callback){
        try{
            const {category_id} = request_data;
            var selectPostFilterCategoryQuery = `SELECT 
                p.post_id,
                c.category_name,
                GROUP_CONCAT(DISTINCT i.image_name ORDER BY i.image_id SEPARATOR ', ') AS image_names,
                p.post_type
            FROM tbl_post p
            INNER JOIN tbl_category c ON p.category_id = c.category_id
            LEFT JOIN tbl_post_image_relation pi ON pi.post_id = p.post_id
            LEFT JOIN tbl_image i ON i.image_id = pi.image_id AND i.is_active = 1 AND i.is_deleted = 0
            WHERE p.is_active = 1 AND p.is_deleted = 0
              AND c.category_id = ?
            GROUP BY p.post_id, c.category_name, p.post_type;`;

            const [posts] = await database.query(selectPostFilterCategoryQuery, [category_id]);
            
            return callback({
                code: response_code.SUCCESS,
                message: t('posts'),
                data: posts
            });

        } catch(error){
            return callback({
                code: response_code.OPERATION_FAILED,
                message: t('some_error_occurred'),
                data: error
            })
        }
    }
}

module.exports = new userModel();