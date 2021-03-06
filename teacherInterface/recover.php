<?php 
/* Copyright (c) 2012 Association France-ioi, MIT License http://opensource.org/licenses/MIT */

require_once("../shared/common.php");
require_once("commonAdmin.php");
require_once 'config.php';

function getUserFromEmail($db, $email) {
   $query = "SELECT * FROM `user` WHERE (`officialEmail` = ? OR `alternativeEmail` = ?)";
   $stmt = $db->prepare($query);
   $stmt->execute(array($email, $email));
   return $stmt->fetchObject();
}


function sendRecoverEmail($sEmail, $sRecoverCode) {
   global $config;
   sendMail($sEmail, $sTitle, $sBody, $sFrom, $config->email->sInfoAddress, $sInfos = '');
}


function recoverSendMail($db, $sEmail) {
   global $config;
   $row = getUserFromEmail($db, $sEmail);
   if (!$row) {
      echo json_encode(array("success" => false));
      return;
   }
   $sRecoverCode = generateSalt();
   $query = "UPDATE `user` SET `recoverCode` = ? WHERE `ID` = ?";
   $stmt = $db->prepare($query);
   $stmt->execute(array($sRecoverCode, $row->ID));

   if ($sEmail !== "")
   {
      $link = $config->teacherInterface->sCoordinatorFolder."/recover.php?action=recover&email=".urlencode($sEmail)."&recoverCode=".urlencode($sRecoverCode);
      $sBody = "Bonjour,\r\n\r\nPour définir un nouveau mot de passe, ouvrez le lien suivant dans votre navigateur  : \r\n\r\n".$link."\r\n\r\nN'hésitez pas à nous contacter si vous rencontrez des difficultés.\r\n\r\nCordialement,\r\n--\r\nL'équipe du Castor Informatique";

      $sTitle = "Réinitialisation de mot de passe Coordinateur Castor Informatique";
      sendMail($sEmail, $sTitle, $sBody, $config->email->sEmailSender);
      //$params = array('recoverCode' => $recoverCode, 'email' => $email);
      //http_post("eval01.france-ioi.org", 80, "/castor/sendMail2.php", $params);
   }
   echo json_encode(array("success" => true));
}

if (!isset($_REQUEST["action"])) {
   echo "Le lien est invalide.";
   exit;
} 

$action = $_REQUEST["action"];
$email = $_REQUEST["email"];
if ($action == "sendMail") {
   recoverSendMail($db, $email);
} else if ($action == "recover"){
   $recoverCode = $_REQUEST["recoverCode"];
   $row = getUserFromEmail($db, $email);
   if (!$row || $row->recoverCode != $recoverCode) {
      echo "Le lien est invalide.";
      return;
   }
   echo "
   <!DOCTYPE html>
   <html>
   <head>
      <meta http-equiv='Content-Type' content='text/html; charset=utf-8' />";
      stylesheet_tag('/bower_components/jquery-ui/themes/base/jquery-ui.min.css');
      stylesheet_tag('/admin.css');
      script_tag('/bower_components/jquery/jquery.min.js');
      script_tag('/bower_components/jquery-ui/jquery-ui.min.js');
      script_tag('/bower_components/i18next/i18next.min.js');
      echo "
      <script type='text/javascript'>
         window.config = ".json_encode([
            'defaultLanguage' => $config->defaultLanguage,
            'countryCode' => $config->teacherInterface->countryCode,
            'infoEmail' => $config->email->sInfoAddress,
            'forceOfficialEmailDomain' => $config->teacherInterface->forceOfficialEmailDomain,
            'contestPresentationURL' => $config->contestPresentationURL,
            'i18nResourcePath' => static_asset('/i18n/__lng__/__ns__.json'),
            'customStringsName' => $config->customStringsName
         ]).";
      function getRegions() { return {} };
      </script>";
      script_tag('/admin.js');
      echo "<script type=\"text/javascript\">
         i18n.init({
            lng: config.defaultLanguage,
            fallbackLng: [config.defaultLanguage],
            getAsync: true,
            resGetPath: config.i18nResourcePath,
            fallbackNS: 'translation',
            ns: {
               namespaces: config.customStringsName ? [config.customStringsName, 'translation', 'country' + config.countryCode] : ['translation', 'country' + config.countryCode],
               defaultNs: config.customStringsName ? config.customStringsName : 'translation',
            },
            useDataAttrOptions: true
         }, function () {
            $(\"title\").i18n();
            $(\"body\").i18n();
         });
      </script>
   </head>
   <body>
   <div id='divHeader'>
        <table style='width:100%'><tr>
            <td style='width:20%'><img src='images/castor_small.png'/></td>
            <td><p class='headerH1'>Castor Informatique France</p>
            <p class='headerH2'> Plate-forme du concours Castor - <span style='color:red;font-weight:bold'>ACCES COORDINATEUR</span></p>
            </td>
            <td></td>
         </tr></table>
   </div>
   <div class='dialog'>
      Entrez votre nouveau mot de passe : <input type='password' id='newPassword1' /><br/>
      Entrez de nouveau pour le confirmer : <input type='password' id='newPassword2' /><br/>
      <input type='button' id='buttonChangePassword' value='Valider' onclick='changePassword(\"".$email."\", \"".$row->recoverCode."\")' />
   </div></html>
   ";
} else if ($action === "changePassword") {
   $recoverCode = $_REQUEST["recoverCode"];
   $password = $_REQUEST["password"];
   $row = getUserFromEmail($db, $email);
   if (!$row || $row->recoverCode != $recoverCode) {
      echo "Le lien est invalide.";
      return;
   }
   $query = "UPDATE `user` SET `passwordMd5` = ? WHERE `ID` = ?";
   $stmt = $db->prepare($query);
   $passwordMd5 = computePasswordMD5($password, $row->salt);   
   $stmt->execute(array($passwordMd5, $row->ID));
   echo json_encode(array("success" => true));
}
unset($db);
