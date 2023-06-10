<?php
require_once  '/var/www/vendor/autoload.php';
use Spatie\PdfToText\Pdf;
use LukeMadhanga\DocumentParser;
$text="";

foreach($_FILES['file']['tmp_name'] as $i=>$tmp_name){
  $type=$_FILES['file']['type'][$i];
  if($type=="application/pdf"){
    $text.=Pdf::getText($tmp_name);
  }
  elseif($type=="application/vnd.openxmlformats-officedocument.wordprocessingml.document" || $type=="application/msword"){
    $t=DocumentParser::parseFromFile($tmp_name,$type);
    $tags = array('</p>','<br />','<br>','<hr />','<hr>','</h1>','</h2>','</h3>','</h4>','</h5>','</h6>');
    $t = str_replace($tags,"\n",$t);
    $text.=strip_tags($t);
  }elseif($type=='text/plain'){
    $text.=file_get_contents($tmp_name);
  }
}

echo json_encode(["result"=>"success","text"=>$text,"files"=>$_FILES,"post"=>$_POST]);
?>