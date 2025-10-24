<?php
/**
 * Plugin Name: Enable Application Passwords
 * Description: Force enable Application Passwords for local development (HTTP)
 * Version: 1.0.0
 */

// Enable Application Passwords for local development on HTTP
add_filter('wp_is_application_passwords_available', '__return_true');
