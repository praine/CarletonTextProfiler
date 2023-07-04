var app = new Vue({
  el: '#app',
  mixins: [mainMixin],
  data: {
    pastedText: '',
    showAdvancedSettings: false,
    forms: {},
    tswk: 80,
    eslaLevel: 1300,
    screen: 'upload',
    myDropzone: null,
    processing: false,
    hasFiles: false,
    response: null,
    plainText: '',
    processMethod: 'merged'
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
      vm.showLoadingModal();
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
      vm.processing = false;

      vm.response = JSON.parse(response);
      vm.hideLoadingModal();
      console.log(vm.response);
      if (vm.response.result == 'success') {
        vm.screen = 'results';
        vm.forms = vm.getForms();
      } else {
        alert(vm.response.message);
      }
      vm.clearFiles();
    });

  },
  created() {

  },
  methods: {
    clearText() {
      this.pastedText = '';
    },
    processText() {
      var vm = this;
      vm.showLoadingModal();
      axios
        .post("/file-upload.php", {
          processMethod: "copypaste",
          pastedText: vm.pastedText
        })
        .then(function(response) {
          vm.hideLoadingModal();
          vm.response = response.data;
          if (vm.response.result == 'success') {
            vm.screen = 'results';
            vm.forms = vm.getForms();
          } else {
            alert(vm.response.message);
          }
        })
        .catch(function(error) {
          console.error(error);
        });
    },
    getForms() {
      var vm = this;
      var forms = {},
        found, tagClasses, category;
      if (this.response) {
        this.response.tags.forEach(function(tag, idx) {
          if (tag.esla_item) {
            if (!forms[tag.esla_item.headword]) {
              tagClasses = vm.tagClasses(tag, idx);
              Object.keys(tagClasses).forEach(function(key) {
                if (tagClasses[key] && !['tag', 'tagspace'].includes(key)) {
                  category = key.toUpperCase();
                }
              })
              forms[tag.esla_item.headword] = {
                count: 1,
                category: category,
                types: [{
                  word: tag.pos == "PROPN" ? tag.word : tag.word.toLowerCase(),
                  count: 1
                }]
              };
            } else {
              forms[tag.esla_item.headword].count++;
              found = forms[tag.esla_item.headword].types.find(function(e) {
                if (tag.pos == "PROPN") {
                  return e.word == tag.word
                } else {
                  return e.word.toLowerCase() == tag.word.toLowerCase()
                }
              });
              if (!found) {
                forms[tag.esla_item.headword].types.push({
                  word: tag.pos == "PROPN" ? tag.word : tag.word.toLowerCase(),
                  count: 1
                })
              } else {
                found.count++;
              }
            }
          }
        })
        return forms;
      } else {
        return {};
      }
    },
    tagClasses(tag, idx) {
      var nextTag = this.response.tags[idx + 1],
        tagspace = false,
        propn = false,
        known = false,
        isKnown = false,
        awl = false,
        unknown = false,
        num = false;
      var tagTswk = 0;
      if (tag.esla_item) {
        tagTswk = 100 - (100 * tag.esla_item[this.eslaLevel]);
      }
      if (nextTag && nextTag.pos == "PUNCT") {
        tagspace = false;
      } else {
        tagspace = true;
      }
      if (tag.pos == "PROPN") {
        propn = true;
      } else if (tag.pos == "NUM") {
        num = true;
      } else if (tagTswk >= this.tswk) {
        known = true;
      } else if (tag.awl) {
        awl = true;
      } else if (tag.pos != "PUNCT") {
        unknown = true;
      }
      return {
        'tag': true,
        'tagspace': tagspace,
        'propn': propn,
        'known': known,
        'awl': awl,
        'unknown': unknown,
        'num': num
      };
    },
    clearFiles() {
      this.myDropzone.removeAllFiles();
    },
    processFiles() {
      this.processing = true;
      this.myDropzone.processQueue();
    }
  }
})