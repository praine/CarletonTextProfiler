var app = new Vue({
  el: '#app',
  mixins: [mainMixin],
  data: {
    tagArrayPointer: 0,
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
    processMethod: 'merged',
    maxWords: {batched:25000,merged:5000},
    pwkr: 95
  },
  watch: {
    screen(){
      if(this.screen=='copypaste'){
        this.processMethod="merged";
      }
    },
    tagArrayPointer() {
      this.forms = this.getForms();
    },
    eslaLevel() {
      this.forms = this.getForms();
    },
    tswk() {
      this.forms = this.getForms();
    },
    pwkr() {
      this.forms = this.getForms();
    }
  },
  mounted() {

    var vm = this;

    Dropzone.autoDiscover = false;

    vm.myDropzone = new Dropzone("div#myDropzone", {
      url: "/file-upload.php",
      acceptedFiles: 'application/pdf, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document, text/plain',
      maxFilesize: 4,
      autoProcessQueue: false,
      addRemoveLinks: true,
      uploadMultiple: true,
      parallelUploads: 50,
      maxFiles: 25
    });

    vm.myDropzone.on("sending", function(file, xhr, formData) {
      formData.append("processMethod", vm.processMethod);
      vm.showLoadingModal();
    });

    vm.myDropzone.on("addedfile", file => {
      vm.hasFiles = true;
    });

    vm.myDropzone.on("removedfile", file => {
      vm.hasFiles = vm.myDropzone.files.length > 0;
    });

    vm.myDropzone.on("successmultiple", (file, response) => {
      vm.processing = false;

      vm.response = JSON.parse(response);
      vm.hideLoadingModal();
      if (vm.response.result == 'success') {
        vm.screen = 'results';
        vm.forms = vm.getForms();
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          html: vm.response.message,
        })
      }
      vm.clearFiles();
    });

  },
  created() {

  },
  methods: {
    getKnownWordsPercent() {
      var vm = this;
      var knownCount = 0,
        totalCount = 0,
        form = null;
      this.response.tags_array[this.tagArrayPointer].tags.forEach(function(tag) {
        if (tag.esla_item) {
          form = vm.forms[tag.esla_item.headword];
        } else {
          form = null;
        }
        if (form) {
          totalCount++;
        }
        if (form && ['NUM', 'KNOWN', 'PART'].includes(form.category)) {
          knownCount++;
        }
      })
      return Math.round(knownCount / totalCount * 100);
    },
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
            Swal.fire({
              icon: 'error',
              title: 'Error',
              html: vm.response.message,
            })
          }
        })
        .catch(function(error) {
          console.error(error);
        });
    },
    getForms() {
      var vm = this;
      var forms = {},
        found, tagClasses, category, form;
      if (this.response) {
        this.response.tags_array[this.tagArrayPointer].tags.filter(function(e){return e.pos!="PUNCT";}).forEach(function(tag, idx) {
          form = tag.word;
          if (tag.esla_item) {
            form = tag.esla_item.headword;
          }
          if (!forms[form]) {
            tagClasses = vm.tagClasses(tag, idx);
            Object.keys(tagClasses).forEach(function(key) {
              if (tagClasses[key] && !['tag', 'tagspace'].includes(key)) {
                category = key.toUpperCase();
              }
            })
            forms[form] = {
              count: 1,
              category: category,
              types: [{
                word: tag.pos == "PROPN" ? tag.word : tag.word.toLowerCase(),
                count: 1
              }]
            };
          } else {
            forms[form].count++;
            found = forms[form].types.find(function(e) {
              if (tag.pos == "PROPN") {
                return e.word == tag.word
              } else {
                return e.word.toLowerCase() == tag.word.toLowerCase()
              }
            });
            if (!found) {
              forms[form].types.push({
                word: tag.pos == "PROPN" ? tag.word : tag.word.toLowerCase(),
                count: 1
              })
            } else {
              found.count++;
            }
          }
        })
        return forms;
      } else {
        return {};
      }
    },
    tagClasses(tag, idx) {
      var nextTag = this.response.tags_array[this.tagArrayPointer].tags[idx + 1],
        tagspace = false,
        propn = false,
        known = false,
        isKnown = false,
        awl = false,
        unknown = false,
        num = false,
        part = false;
      var tagTswk = 0;
      if (tag.esla_item) {
        tagTswk = 100 - (100 * tag.esla_item[this.eslaLevel]);
      }
      if (nextTag && (["PUNCT"].includes(nextTag.pos) || nextTag.word.includes("'"))) {
        tagspace = false;
      } else {
        tagspace = true;
      }
      if (tag.pos == "PROPN") {
        propn = true;
      }else if (tag.pos == "PART") {
        part = true;
      } 
      else if (tag.pos == "NUM") {
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
        'num': num,
        'part':part
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