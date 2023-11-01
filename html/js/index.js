var app = new Vue({
  el: '#app',
  mixins: [mainMixin],
  data: {
    multipleFiles: false,
    tagArrayPointer: 0,
    pastedText: `If, how, when, where, why? Do you want Paul's cake? Ought we? Shall we? Whilst you were doing that whereby albeit! Are you a flurmi? No I'm a dermifloop. My name is Paul, and I'm a ventriloquist. Can you review these fractions accurately? I want to send you an e-mail at 5 o'clock. You're not serious. I'll see you in twenty-five minutes. 1 2 3 4 5 6 7 8 9 one two three four five six seven eight nine ten. Hello, Mr. Smith, this is Dr. Smith.`,
    showAdvancedSettings: false,
    forms: {},
    tswk: 80,
    pwkr: 95,
    eslaLevel: 1300,
    screen: 'copypaste',
    myDropzone: null,
    processing: false,
    hasFiles: false,
    response: null,
    plainText: '',
    processMethod: 'merged',
    maxWords: {
      batched: 25000,
      merged: 5000
    },
    radio_steps: [50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100]
  },
  watch: {
    showAdvancedSettings() {
      Vue.nextTick(function() {
        tippy('.info-box');
      })
    },
    multipleFiles() {
      if (!this.multipleFiles) {
        this.processMethod = "merged";
      }
    },
    screen() {
      if (this.screen == 'copypaste') {
        this.processMethod = "merged";
      }
    },
    tagArrayPointer() {
      this.forms = this.getForms();
      this.getClasses();


    },
    eslaLevel() {
      this.forms = this.getForms();
      this.getClasses();

    },
    tswk() {
      this.forms = this.getForms();
      this.getClasses();

    },
    pwkr() {
      this.forms = this.getForms();
      this.getClasses();

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
      parallelUploads: 25,
      maxFiles: 25
    });

    vm.myDropzone.on("sending", function(file, xhr, formData) {
      formData.append("processMethod", vm.processMethod);
      vm.showLoadingModal();
    });

    vm.myDropzone.on("addedfile", file => {
      vm.hasFiles = true;
      vm.multipleFiles = vm.myDropzone.files.length > 1;
    });

    vm.myDropzone.on("removedfile", file => {
      vm.hasFiles = vm.myDropzone.files.length > 0;
      vm.multipleFiles = vm.myDropzone.files.length > 1;
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
    showTagDetails(tag){
      alert(JSON.stringify(tag));
    },
    totalWords() {
      return this.response.tags_array[this.tagArrayPointer].tags.filter(function(e) {
        return ['KNOWN', 'UNKNOWN', 'UNKNOWN ACADEMIC', 'PROPER NOUN'].includes(e.category)
      }).length;
    },
    knownWords() {
      return this.response.tags_array[this.tagArrayPointer].tags.filter(function(e) {
        return e.category == "KNOWN"
      }).length;
    },
    downloadTable() {
      $("#data-table").table2csv();
    },
    getKnownItemsPercent() {
      return Math.round(this.knownWords() / this.totalWords() * 100);
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
            vm.getClasses();

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
      this.response.tags_array[this.tagArrayPointer].tags.filter(function(tag) {
        return !['PUNCT', 'SYM'].includes(tag.pos);
      }).forEach(function(tag, idx) {

        form = tag.word.toUpperCase();
        category = "";
        tag.tswk = 0;
        
        if (tag.esla_item) {
          tag.tswk = 100 - (100 * tag.esla_item[vm.eslaLevel]);
          form = tag.esla_item.headword;
        }

        // (proper noun)
        if (tag.pos == "PROPN") {
          category = "PROPER NOUN";
        } 
        
        // Form is marked known
        else if (tag.tswk >= vm.tswk || ['AUX', 'NUM', 'PART'].includes(tag.pos)) {
          category = "KNOWN";
        }
        
        // unclear
        else if (!tag.esla_item) {
          category = "UNCLEAR";
        }

        // (unknown academic)
        else if (tag.esla_item && tag.esla_item.awl) {
          category = "UNKNOWN ACADEMIC";
        }

        // Tag is marked red (unknown non-academic)
        else {
          category = "UNKNOWN";
        }

        tag.category = category;

        if (!forms[form]) {
          forms[form] = {
            count: 1,
            category: category,
            types: [{
              word: tag.word,
              count: 1
            }]
          };
        } else {
          forms[form].count++;
          found = forms[form].types.find(function(e) {
            return e.word == tag.word
          });
          if (!found) {
            forms[form].types.push({
              word: tag.word,
              count: 1
            })
          } else {
            found.count++;
          }
        }

      })
      return forms;
    },
    getClasses() {
      var vm = this;
      var color;
      vm.response.tags_array[vm.tagArrayPointer].tags.forEach(function(tag, i) {


        if (["PUNCT"].includes(tag.pos)) {
          color='black';
        }

        // Tag is marked green (known)
        else if (tag.category == "KNOWN") {
          color='green';
        }

        // Tag is marked blue (proper noun)
        else if (tag.category == "PROPER NOUN") {
          color='blue';
        } 
        
        else if (tag.category == "UNCLEAR") {
          color='orange';
        }

        // Tag is marked purple (unknown academic)
        else if (tag.esla_item && tag.esla_item.awl) {
          color='purple';
        }

        // Tag is marked red (unknown non-academic)
        else {
          color='red';
        }

        tag.classes = {
          'tag': true,
        };
        tag.classes[color] = true;
      });
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