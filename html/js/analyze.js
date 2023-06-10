var app = new Vue({
  el: '#app',
  data: {
    screen: 'upload',
    myDropzone: null,
    processing: false,
    hasFiles: false,
    results: null,
    processMethod: 'batched'
  },
  mounted() {

    var vm = this;

    Dropzone.autoDiscover = false;

    vm.myDropzone = new Dropzone("div#myDropzone", {
      url: "/file-upload.php",
      acceptedFiles: 'application/pdf, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document, text/plain',
      maxFilesize: 50,
      autoProcessQueue: false,
      addRemoveLinks: true,
      uploadMultiple: true,
      parallelUploads: 5,
      maxFiles: 5
    });

    vm.myDropzone.on("sending", function(file, xhr, formData) {
      formData.append("processMethod", vm.processMethod);
    });

    vm.myDropzone.on("addedfile", file => {
      console.log("A file has been added");
      vm.hasFiles = true;
    });

    vm.myDropzone.on("removedfile", file => {
      console.log("A file has been removed");
      vm.hasFiles = vm.myDropzone.files.length > 0;
    });

    vm.myDropzone.on("successmultiple", (file, response) => {
      console.log("success!");
      console.log(response);
      vm.processing = false;
      vm.screen='results';
      vm.results=response;
      vm.clearFiles();
    });

  },
  created() {

  },
  methods: {
    clearFiles() {
      this.myDropzone.removeAllFiles();
    },
    processFiles() {
      this.processing = true;
      this.myDropzone.processQueue();
    }
  }
})