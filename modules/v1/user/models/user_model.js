const common = require("../../../../utilities/common");
const database = require("../../../../config/database");
const response_code = require("../../../../utilities/response-error-code");
const md5 = require("md5");

class userModel {
    async signup(request_data, callback) {
        try {
            console.log(request_data);
            if (!request_data.email_id || !request_data.user_name || !request_data.code_id || !request_data.mobile_number || !request_data.passwords) {
                return callback({
                    code: response_code.OPERATION_FAILED,
                    message: "Missing required fields"
                });
            }

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
            console.log(existingUsers);
            console.log(existingUsers.length)

            if (existingUsers.length > 0) {
                const user_data_ = existingUsers[0];

                if (existingUsers.length > 1) {
                    await database.query(
                        "UPDATE tbl_user SET is_deleted = 1 WHERE user_id = ?",
                        [existingUsers[1]?.user_id]
                    );
                }

                const otp_obj = request_data.otp ? { otp: request_data.otp } : {};

                common.updateUserInfo(user_data_.user_id, otp_obj, (error, updateUser) => {
                    if (error) {
                        console.log("Error here: ", error);
                        return callback({
                            code: response_code.OPERATION_FAILED,
                            message: error
                        });
                    }
                    return callback({
                        code: response_code.SUCCESS,
                        message: "User Signed up",
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
                                message: err
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
                                message: "User Signed Up Successfully... Verification Pending",
                                data: userInfo
                            });
                        } else {
                            return callback({
                                code: response_code.SUCCESS,
                                message: "User Signed Up Successfully... Verification and Profile Completion is Pending",
                                data: userInfo
                            });
                        }
                    } catch (tokenError) {
                        console.error("Token update error:", tokenError);
                        return callback({
                            code: response_code.OPERATION_FAILED,
                            message: "Error updating tokens"
                        });
                    }
                });
            }

        } catch (error) {
            console.error("Signup error:", error);
            return callback({
                code: response_code.OPERATION_FAILED,
                message: "An error occurred during signup"
            });
        }
    }

    async enterOtp(user_id){
        const otp = common.generateOtp(4);
        const insertOtpQuery = "INSERT INTO tbl_otp (user_id, otp) VALUES (?, ?)";
        await database.query(insertOtpQuery, [user_id, otp]);
        console.log("OTP sent to user_id:", user_id, "OTP:", otp);
    }

    async verify(request_data, callback){
        const { user_id, otp } = request_data;
        var verifyOtpQuery = "UPDATE tbl_user u INNER JOIN tbl_otp o ON u.user_id = o.user_id SET u.is_verify = 1 WHERE u.user_id = ? AND o.otp = ?";
        try {
            const [result] = await database.query(verifyOtpQuery, [user_id, otp]);
            if (result.affectedRows > 0) {
                return callback({
                    code: response_code.SUCCESS,
                    message: "User verified successfully"
                });
            } else {
                return callback({
                    code: response_code.NOT_FOUND,
                    message: "Invalid OTP or user not found"
                });
            }
        } catch (error) {
            return callback({
                code: response_code.OPERATION_FAILED,
                message: error.sqlMessage || "Error verifying OTP"
            });
        }
    }

    async login(request_data, callback){
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

        console.log(user_data);

        try{
            const [status] = await database.query(selectUserWithCred, params);

            console.log("Status: ", status);
            console.log(status.length);

            if (status.length === 0) {
                console.log(status.length);
                return callback({
                    code: response_code.NOT_FOUND,
                    message: "No User Found"
                });
            }

            const user_id = status[0].user_id;
            console.log(user_id);

            const token = common.generateToken(40);
            // console.log(token);
            const updateTokenQuery = "UPDATE tbl_user SET token = ?, is_login = 1 WHERE user_id = ?";
            await database.query(updateTokenQuery, [token, user_id]);

            const device_token = common.generateToken(40);
            const updateDeviceToken = "UPDATE tbl_device_info SET device_token = ? WHERE user_id = ?";
            await database.query(updateDeviceToken, [device_token, user_id]);

            common.getUserDetailLogin(user_id, (err, userInfo)=>{
                console.log("getUserDetailLogin callback:", err, userInfo);
                if(err){
                    console.log("Error here", err);
                    return callback({
                        code: response_code.OPERATION_FAILED,
                        message: "Some Error"
                    });
                }
                else{
                    userInfo.token = token;
                    userInfo.device_token = device_token;
                    return callback({
                        code: response_code.SUCCESS,
                        message: "User Signed in Successfully",
                        data: userInfo
                    });

                }
            });

        } catch(error){
            return callback({
                code: response_code.OPERATION_FAILED,
                message: error.sqlMessage || "SOME ERROR IN LOGIN"
            });
        }

    }
}

module.exports = new userModel();